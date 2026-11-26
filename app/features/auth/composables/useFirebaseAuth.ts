import {
  getMultiFactorResolver,
  multiFactor,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  TotpMultiFactorGenerator,
  type Auth,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
} from 'firebase/auth'
import { useAuthStore, type AdminUser } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { hasStoredPushToken } from '@/features/mobile/lib/pushStorage'
import { noteSignedIn } from '@/features/mobile/lib/lockState'

/** Nom du compte dans l'appli d'authentification (Google Authenticator, 1Password…). */
const TOTP_ISSUER = 'Yadony Admin'
/** Libellé du facteur inscrit, visible dans la console Firebase. */
const TOTP_FACTOR_NAME = 'Appli d’authentification'

/**
 * Défi en cours entre le mot de passe et le code : gardé au niveau du module, la page de
 * connexion passe de l'étape mot de passe à l'étape code sans recréer le résolveur.
 */
let pendingResolver: MultiFactorResolver | null = null

/** Vrai si l'utilisateur a un facteur TOTP inscrit. */
export function hasTotpFactor(user: User): boolean {
  return multiFactor(user).enrolledFactors.some((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID)
}

export interface TotpEnrollment {
  secret: TotpSecret
  /** Clé à saisir à la main si le QR code ne peut pas être scanné. */
  secretKey: string
  /** URL otpauth:// à afficher en QR code. */
  qrCodeUrl: string
}

export function useFirebaseAuth() {
  const { $firebaseAuth } = useNuxtApp()
  const authStore = useAuthStore()
  const api = useApi()

  function requireAuth(): Auth {
    if (!$firebaseAuth) {
      throw new Error('Firebase Auth non initialisé. Vérifie la configuration Firebase dans .env.')
    }
    return $firebaseAuth as Auth
  }

  function requireCurrentUser(): User {
    const user = requireAuth().currentUser
    if (!user) throw new Error('Aucun administrateur connecté')
    return user
  }

  async function refreshProfile(token?: string): Promise<AdminUser> {
    if (token) {
      authStore.idToken = token
    }
    const adminUser = await api<AdminUser>('/admin/me')
    authStore.setSession(authStore.idToken ?? '', adminUser)
    return adminUser
  }

  async function openSession(user: User): Promise<AdminUser> {
    authStore.setMfaEnrolled(hasTotpFactor(user))
    const token = await user.getIdToken(true)
    const adminUser = await refreshProfile(token)
    // Connexion complète (connexion ou déverrouillage) : le verrou de l'app mobile est levé et
    // l'inactivité repart de maintenant. En cas d'échec du profil, le marqueur reste (échec fermé).
    noteSignedIn()
    return adminUser
  }

  /**
   * Étape mot de passe. Un compte avec second facteur fait lever
   * `auth/multi-factor-auth-required` : le résolveur est gardé pour {@link completeTotpSignIn}
   * et l'erreur remonte telle quelle, la page affiche alors la saisie du code.
   */
  async function signIn(email: string, password: string): Promise<AdminUser> {
    const auth = requireAuth()
    pendingResolver = null
    const normalized = email.trim().toLowerCase()
    try {
      const credential = await signInWithEmailAndPassword(auth, normalized, password)
      return await openSession(credential.user)
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'auth/multi-factor-auth-required') {
        pendingResolver = getMultiFactorResolver(auth, e as MultiFactorError)
      }
      throw e
    }
  }

  /** Étape code : termine la connexion avec le code à 6 chiffres de l'appli d'authentification. */
  async function completeTotpSignIn(code: string): Promise<AdminUser> {
    const resolver = pendingResolver
    const hint = resolver?.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)
    if (!resolver || !hint) {
      throw new Error('Aucune connexion en attente de code')
    }
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.replace(/\s+/g, ''))
    const credential = await resolver.resolveSignIn(assertion)
    pendingResolver = null
    return openSession(credential.user)
  }

  /** Abandonne une connexion restée à l'étape code (retour au mot de passe). */
  function cancelTotpSignIn(): void {
    pendingResolver = null
  }

  /** Génère le secret TOTP de l'admin connecté et l'URL à afficher en QR code. */
  async function startTotpEnrollment(): Promise<TotpEnrollment> {
    const user = requireCurrentUser()
    const session = await multiFactor(user).getSession()
    const secret = await TotpMultiFactorGenerator.generateSecret(session)
    return {
      secret,
      secretKey: secret.secretKey,
      qrCodeUrl: secret.generateQrCodeUrl(user.email ?? 'admin', TOTP_ISSUER),
    }
  }

  /**
   * Inscrit le facteur avec le premier code de l'appli, puis déconnecte : seule une nouvelle
   * connexion (mot de passe + code) ouvre une session qui porte le second facteur exigé par le back.
   */
  async function finishTotpEnrollment(secret: TotpSecret, code: string): Promise<void> {
    const user = requireCurrentUser()
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.replace(/\s+/g, ''))
    await multiFactor(user).enroll(assertion, TOTP_FACTOR_NAME)
    await fbSignOut(requireAuth())
    authStore.clear()
    await navigateTo('/login?mfa=enrolled')
  }

  /** Firebase n'inscrit un second facteur que sur une adresse vérifiée. */
  async function sendVerificationEmail(): Promise<void> {
    await sendEmailVerification(requireCurrentUser())
  }

  /**
   * `revokePush: false` pour un simple verrouillage (inactivité) : les push continuent d'arriver.
   * Sinon l'abonnement push de l'appareil est révoqué avant la déconnexion (meilleur effort).
   * `redirectTo` : page ouverte ensuite (`/login` par défaut ; la page de verrouillage pour le
   * verrou mobile, sans passage par `/login`).
   */
  async function signOut(
    { revokePush = true, redirectTo = '/login' }: { revokePush?: boolean, redirectTo?: string } = {},
  ): Promise<void> {
    pendingResolver = null
    // Module push (firebase/messaging) chargé seulement s'il y a un jeton à révoquer : il n'entre
    // pas dans le bundle de la console de bureau.
    if (revokePush && hasStoredPushToken()) {
      try {
        const { clearPushOnLogout } = await import('@/features/mobile/composables/usePushSubscription')
        await clearPushOnLogout()
      } catch { /* module indisponible (hors ligne) : la déconnexion continue */ }
    }
    // Échec fermé : le store est vidé même si Firebase refuse de se déconnecter (hors ligne,
    // erreur IndexedDB), sinon le middleware verrait encore un admin connecté. L'erreur est
    // relancée après coup pour que l'appelant sache que la déconnexion Firebase a échoué.
    let failure: unknown = null
    try {
      if ($firebaseAuth) {
        await fbSignOut($firebaseAuth as Auth)
      }
    } catch (e: unknown) {
      failure = e
    } finally {
      authStore.clear()
    }
    await navigateTo(redirectTo)
    if (failure) throw failure
  }

  return {
    signIn,
    completeTotpSignIn,
    cancelTotpSignIn,
    startTotpEnrollment,
    finishTotpEnrollment,
    sendVerificationEmail,
    signOut,
    refreshProfile,
  }
}
