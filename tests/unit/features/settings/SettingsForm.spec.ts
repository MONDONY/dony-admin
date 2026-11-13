import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsForm from '@/features/settings/components/SettingsForm.vue'
import type { PlatformSetting } from '@/features/settings/types/index'

// Le back stocke un TAUX, pas un pourcentage : `commission_rate` vaut `0.05` pour 5 %.
// C'est la même valeur que `ConfigController` sert à l'application mobile déjà installée.
const commission: PlatformSetting = {
  key: 'commission_rate', value: '0.05', type: 'DECIMAL',
  updatedAt: null, updatedByEmail: null,
}
const urgency: PlatformSetting = {
  key: 'urgency_threshold_days', value: '3', type: 'INTEGER',
  updatedAt: '2026-08-10T09:00:00Z', updatedByEmail: 'admin@yadony.com',
}
const cap: PlatformSetting = {
  key: 'reimbursement_cap_eur', value: '50', type: 'DECIMAL',
  updatedAt: null, updatedByEmail: null,
}
const sms: PlatformSetting = {
  key: 'sms_enabled', value: 'true', type: 'BOOLEAN',
  updatedAt: null, updatedByEmail: null,
}
// Code SMS réservé aux numéros inscrits (parade au pompage de SMS du 08/11/2026) : activé par défaut.
const smsRegisteredOnly: PlatformSetting = {
  key: 'sms_otp_registered_numbers_only', value: 'true', type: 'BOOLEAN',
  updatedAt: null, updatedByEmail: null,
}
// Numéros différents par compte avant suspension automatique (codes SMS, 24 h) : 3 par défaut.
const smsMaxNumbers: PlatformSetting = {
  key: 'sms_otp_max_numbers_per_account', value: '3', type: 'INTEGER',
  updatedAt: null, updatedByEmail: null,
}
// Plafond global des SMS de code (toute l'app) : 30 par heure et 150 par 24 h par défaut.
const smsPerHour: PlatformSetting = {
  key: 'sms_otp_max_sends_per_hour_global', value: '30', type: 'INTEGER',
  updatedAt: null, updatedByEmail: null,
}
const smsPerDay: PlatformSetting = {
  key: 'sms_otp_max_sends_per_day_global', value: '150', type: 'INTEGER',
  updatedAt: null, updatedByEmail: null,
}
// Feature flag de l'offre PRO : fermé par défaut en production, ouvert depuis cet écran.
const pro: PlatformSetting = {
  key: 'pro_enabled', value: 'false', type: 'BOOLEAN',
  updatedAt: null, updatedByEmail: null,
}

const road: PlatformSetting = {
  key: 'transport_road_enabled', value: 'false', type: 'BOOLEAN',
  updatedAt: null, updatedByEmail: null,
}
const boat: PlatformSetting = {
  key: 'transport_boat_enabled', value: 'false', type: 'BOOLEAN',
  updatedAt: null, updatedByEmail: null,
}

const retention: PlatformSetting = {
  key: 'photo_retention_days_after_delivery', value: '7', type: 'INTEGER',
  updatedAt: null, updatedByEmail: null,
}
const quota: PlatformSetting = {
  key: 'photo_upload_daily_quota', value: '60', type: 'INTEGER',
  updatedAt: null, updatedByEmail: null,
}
const maxTracking: PlatformSetting = {
  key: 'tracking_photos_max_per_bid', value: '12', type: 'INTEGER',
  updatedAt: null, updatedByEmail: null,
}
// Feature flag des billets d'avion : éteint par défaut, allumé depuis cet écran.
const flights: PlatformSetting = {
  key: 'flights_enabled', value: 'false', type: 'BOOLEAN',
  updatedAt: null, updatedByEmail: null,
}
// Statut de voyageur obligatoire pour publier un trajet (lot 2) : facultatif par défaut.
const travelerStatusRequired: PlatformSetting = {
  key: 'traveler_status_required', value: 'false', type: 'BOOLEAN',
  updatedAt: null, updatedByEmail: null,
}
const purge: PlatformSetting = {
  key: 'photo_purge_enabled', value: 'false', type: 'BOOLEAN',
  updatedAt: null, updatedByEmail: null,
}

// Quotas de l'assistant IA, par utilisateur et par jour : aide, et remplissage trajet/colis.
const assistantQuota: PlatformSetting = {
  key: 'assistant_daily_quota', value: '20', type: 'INTEGER',
  updatedAt: null, updatedByEmail: null,
}
const formDraftQuota: PlatformSetting = {
  key: 'assistant_form_draft_daily_quota', value: '30', type: 'INTEGER',
  updatedAt: null, updatedByEmail: null,
}

const remoteConfigFetch: PlatformSetting = {
  key: 'remote_config_fetch_minutes', value: '60', type: 'INTEGER',
  updatedAt: null, updatedByEmail: null,
}

const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] }

function mountForm(props: Partial<InstanceType<typeof SettingsForm>['$props']> = {}) {
  return mount(SettingsForm, {
    props: { settings: [commission, urgency, cap, sms, pro], busy: false, ...props },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

describe('SettingsForm', () => {
  it('affiche la valeur, l’unité lisible et « jamais modifié » quand le réglage n’a jamais été touché', () => {
    const w = mountForm()
    const value = w.find('[data-test="setting-value-commission_rate"]').element as HTMLInputElement
    // 0.05 côté back → 5 à l'écran : la conversion se fait au bord, pas au milieu.
    expect(value.value).toBe('5')
    expect(w.find('[data-test="setting-unit-commission_rate"]').text()).toBe('%')
    expect(w.find('[data-test="setting-meta-commission_rate"]').text()).toContain('Jamais modifié')
  })

  it('affiche qui et quand pour un réglage déjà modifié', () => {
    const w = mountForm()
    const meta = w.find('[data-test="setting-meta-urgency_threshold_days"]').text()
    expect(meta).toContain('admin@yadony.com')
    expect(meta).not.toContain('Jamais modifié')
  })

  it('urgency_threshold_days est présenté en jours — pas en heures', () => {
    const w = mountForm()
    expect(w.find('[data-test="setting-unit-urgency_threshold_days"]').text()).toBe('jours')
    expect(w.html()).not.toContain('heures')
  })

  it('commission hors bornes (0–30) désactive l’enregistrement et affiche le motif, sans appel réseau', async () => {
    const w = mountForm()
    await w.find('[data-test="setting-value-commission_rate"]').setValue('42')

    const btn = w.find('[data-test="setting-save-commission_rate"]').element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(w.find('[data-test="setting-error-commission_rate"]').text()).toContain('0 et 30')

    await w.find('[data-test="setting-save-commission_rate"]').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
  })

  it('commission en dessous de 0 est également refusée', async () => {
    const w = mountForm()
    await w.find('[data-test="setting-value-commission_rate"]').setValue('-1')
    const btn = w.find('[data-test="setting-save-commission_rate"]').element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('plafond de remboursement au-delà de 500 est refusé, sans appel réseau', async () => {
    const w = mountForm()
    await w.find('[data-test="setting-value-reimbursement_cap_eur"]').setValue('501')

    const btn = w.find('[data-test="setting-save-reimbursement_cap_eur"]').element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(w.find('[data-test="setting-error-reimbursement_cap_eur"]').text()).toContain('500')

    await w.find('[data-test="setting-save-reimbursement_cap_eur"]').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
  })

  it('modifier commission (dans les bornes) ouvre une confirmation simple, sans saisie de contrôle', async () => {
    const w = mountForm()
    await w.find('[data-test="setting-value-commission_rate"]').setValue('15')
    await w.find('[data-test="setting-save-commission_rate"]').trigger('click')

    expect(w.find('[data-test="confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)

    await w.find('[data-test="confirm"]').trigger('click')
    // 15 saisi à l'écran → 0.15 sur le fil : le back borne le TAUX à 0.30, pas à 30.
    expect(w.emitted('update')![0]).toEqual(['commission_rate', '0.15'])
  })

  it('la commission fait l’aller-retour taux → pourcentage → taux sans dérive flottante', async () => {
    const w = mountForm({
      settings: [{ ...commission, value: '0.125' }, urgency, cap, sms],
    })
    const value = w.find('[data-test="setting-value-commission_rate"]').element as HTMLInputElement
    expect(value.value).toBe('12.5')

    await w.find('[data-test="setting-save-commission_rate"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['commission_rate', '0.125'])
  })

  it('les autres réglages ne sont PAS convertis — seule la commission change d’échelle', async () => {
    const w = mountForm()
    expect((w.find('[data-test="setting-value-urgency_threshold_days"]').element as HTMLInputElement).value)
      .toBe('3')
    expect((w.find('[data-test="setting-value-reimbursement_cap_eur"]').element as HTMLInputElement).value)
      .toBe('50')

    await w.find('[data-test="setting-value-reimbursement_cap_eur"]').setValue('80')
    await w.find('[data-test="setting-save-reimbursement_cap_eur"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['reimbursement_cap_eur', '80'])
  })

  it('modifier urgency_threshold_days ouvre aussi une confirmation simple', async () => {
    const w = mountForm()
    await w.find('[data-test="setting-value-urgency_threshold_days"]').setValue('5')
    await w.find('[data-test="setting-save-urgency_threshold_days"]').trigger('click')

    expect(w.find('[data-test="confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['urgency_threshold_days', '5'])
  })

  it('annuler une confirmation simple n’émet pas update', async () => {
    const w = mountForm()
    await w.find('[data-test="setting-value-reimbursement_cap_eur"]').setValue('80')
    await w.find('[data-test="setting-save-reimbursement_cap_eur"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')

    expect(w.emitted('update')).toBeUndefined()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('désactiver sms_enabled ouvre une confirmation avec saisie de contrôle mentionnant la connexion des utilisateurs', async () => {
    const w = mountForm()
    await w.find('[data-test="setting-value-sms_enabled"]').setValue('false')
    await w.find('[data-test="setting-save-sms_enabled"]').trigger('click')

    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(true)
    expect(w.text()).toMatch(/se connecter|connexion/)

    const confirmBtn = w.find('[data-test="confirm"]').element as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    await w.find('[data-test="confirmation-input"]').setValue('mauvaise saisie')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)

    expect(w.emitted('update')).toBeUndefined()
  })

  it('la saisie de contrôle correcte débloque la confirmation et émet update pour sms_enabled', async () => {
    const w = mountForm()
    await w.find('[data-test="setting-value-sms_enabled"]').setValue('false')
    await w.find('[data-test="setting-save-sms_enabled"]').trigger('click')

    await w.find('[data-test="confirmation-input"]').setValue('DESACTIVER SMS')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(false)

    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['sms_enabled', 'false'])
  })

  it('réactiver sms_enabled (déjà désactivé) ouvre une confirmation simple — seule la désactivation est dangereuse', async () => {
    const disabledSms: PlatformSetting = { ...sms, value: 'false' }
    const w = mountForm({ settings: [commission, urgency, cap, disabledSms] })
    await w.find('[data-test="setting-value-sms_enabled"]').setValue('true')
    await w.find('[data-test="setting-save-sms_enabled"]').trigger('click')

    expect(w.find('[data-test="confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['sms_enabled', 'true'])
  })

  describe('code SMS réservé aux numéros inscrits (sms_otp_registered_numbers_only)', () => {
    it('porte un libellé lisible, une explication et un sélecteur Activé / Désactivé', () => {
      const w = mountForm({ settings: [sms, smsRegisteredOnly] })
      const row = w.find('[data-test="setting-row-sms_otp_registered_numbers_only"]')
      expect(row.text()).toContain('Code SMS réservé aux numéros déjà inscrits')
      expect(row.text()).not.toContain('sms_otp_registered_numbers_only')
      expect(w.find('[data-test="setting-help-sms_otp_registered_numbers_only"]').text())
        .toContain('email, Google ou Apple')
      expect((w.find('[data-test="setting-value-sms_otp_registered_numbers_only"]').element as HTMLSelectElement).value)
        .toBe('true')
    })

    it('le désactiver exige la phrase OUVRIR SMS et affiche l’avertissement de pompage en rouge', async () => {
      const w = mountForm({ settings: [sms, smsRegisteredOnly] })
      await w.find('[data-test="setting-value-sms_otp_registered_numbers_only"]').setValue('false')
      await w.find('[data-test="setting-save-sms_otp_registered_numbers_only"]').trigger('click')

      expect(w.find('[data-test="confirm-alert"]').text()).toContain('pompage')
      expect(w.find('[data-test="confirmation-input"]').exists()).toBe(true)
      expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)

      await w.find('[data-test="confirmation-input"]').setValue('DESACTIVER SMS')
      expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)
      expect(w.emitted('update')).toBeUndefined()

      await w.find('[data-test="confirmation-input"]').setValue('OUVRIR SMS')
      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('update')![0]).toEqual(['sms_otp_registered_numbers_only', 'false'])
    })

    it('le réactiver : confirmation simple, sans saisie ni avertissement', async () => {
      const opened: PlatformSetting = { ...smsRegisteredOnly, value: 'false' }
      const w = mountForm({ settings: [sms, opened] })
      await w.find('[data-test="setting-value-sms_otp_registered_numbers_only"]').setValue('true')
      await w.find('[data-test="setting-save-sms_otp_registered_numbers_only"]').trigger('click')

      expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
      expect(w.find('[data-test="confirm-alert"]').exists()).toBe(false)
      expect(w.text()).toContain('email, Google ou Apple')
      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('update')![0]).toEqual(['sms_otp_registered_numbers_only', 'true'])
    })
  })

  describe('numéros différents par compte avant suspension (sms_otp_max_numbers_per_account)', () => {
    it('porte un libellé lisible, son unité, ses bornes et l’explication de la suspension et de l’alerte', () => {
      const w = mountForm({ settings: [smsMaxNumbers] })
      const row = w.find('[data-test="setting-row-sms_otp_max_numbers_per_account"]')
      expect(row.text()).toContain('Numéros différents avant suspension ou alerte')
      expect(row.text()).not.toContain('sms_otp_max_numbers_per_account')
      expect(w.find('[data-test="setting-unit-sms_otp_max_numbers_per_account"]').text()).toBe('numéros')
      expect(w.find('[data-test="setting-hint-sms_otp_max_numbers_per_account"]').text()).toBe('Entre 2 et 20')
      const help = w.find('[data-test="setting-help-sms_otp_max_numbers_per_account"]').text()
      expect(help).toContain('suspendu automatiquement')
      expect(help).toContain('téléphone sans compte')
      expect(help).toContain('alerte seulement')
    })

    it('refuse 1 et 21 sans appel réseau, accepte 2 et 20', async () => {
      const w = mountForm({ settings: [smsMaxNumbers] })
      const input = w.find('[data-test="setting-value-sms_otp_max_numbers_per_account"]')
      const save = () => w.find('[data-test="setting-save-sms_otp_max_numbers_per_account"]').element as HTMLButtonElement

      for (const bad of ['1', '21']) {
        await input.setValue(bad)
        expect(save().disabled).toBe(true)
        expect(w.find('[data-test="setting-error-sms_otp_max_numbers_per_account"]').text()).toBe('Entre 2 et 20')
      }
      for (const good of ['2', '20']) {
        await input.setValue(good)
        expect(save().disabled).toBe(false)
      }
      expect(w.emitted('update')).toBeUndefined()
    })

    it('enregistrer ouvre une confirmation simple et envoie la valeur', async () => {
      const w = mountForm({ settings: [smsMaxNumbers] })
      await w.find('[data-test="setting-value-sms_otp_max_numbers_per_account"]').setValue('5')
      await w.find('[data-test="setting-save-sms_otp_max_numbers_per_account"]').trigger('click')

      expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('update')![0]).toEqual(['sms_otp_max_numbers_per_account', '5'])
    })
  })

  describe('plafond global des SMS de code (sms_otp_max_sends_per_hour_global / _per_day_global)', () => {
    it('porte des libellés lisibles, l’unité SMS, les bornes et l’explication', () => {
      const w = mountForm({ settings: [smsPerHour, smsPerDay] })
      expect(w.find('[data-test="setting-row-sms_otp_max_sends_per_hour_global"]').text())
        .toContain('Plafond de SMS de code par heure')
      expect(w.find('[data-test="setting-row-sms_otp_max_sends_per_day_global"]').text())
        .toContain('Plafond de SMS de code par 24 h')
      expect(w.find('[data-test="setting-unit-sms_otp_max_sends_per_hour_global"]').text()).toBe('SMS')
      expect(w.find('[data-test="setting-hint-sms_otp_max_sends_per_hour_global"]').text()).toBe('Entre 1 et 1000')
      expect(w.find('[data-test="setting-hint-sms_otp_max_sends_per_day_global"]').text()).toBe('Entre 1 et 10000')
      expect(w.find('[data-test="setting-help-sms_otp_max_sends_per_hour_global"]').text())
        .toContain('facture SMS maximale')
    })

    it('refuse 0 et 1001 par heure sans appel réseau, accepte 1 et 1000', async () => {
      const w = mountForm({ settings: [smsPerHour] })
      const input = w.find('[data-test="setting-value-sms_otp_max_sends_per_hour_global"]')
      const save = () => w.find('[data-test="setting-save-sms_otp_max_sends_per_hour_global"]').element as HTMLButtonElement

      for (const bad of ['0', '1001']) {
        await input.setValue(bad)
        expect(save().disabled).toBe(true)
      }
      for (const good of ['1', '1000']) {
        await input.setValue(good)
        expect(save().disabled).toBe(false)
      }
      expect(w.emitted('update')).toBeUndefined()
    })

    it('enregistrer le plafond journalier ouvre une confirmation simple et envoie la valeur', async () => {
      const w = mountForm({ settings: [smsPerDay] })
      await w.find('[data-test="setting-value-sms_otp_max_sends_per_day_global"]').setValue('60')
      await w.find('[data-test="setting-save-sms_otp_max_sends_per_day_global"]').trigger('click')

      expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('update')![0]).toEqual(['sms_otp_max_sends_per_day_global', '60'])
    })
  })

  it('pro_enabled porte un libellé lisible et un sélecteur Activé / Désactivé', () => {
    const w = mountForm()
    const row = w.find('[data-test="setting-row-pro_enabled"]')
    expect(row.text()).toContain('Offre PRO')
    // Une clé non mappée retomberait sur sa clé brute : ce test garantit qu'on ne livre
    // pas un « pro_enabled » nu à l'administrateur.
    expect(row.text()).not.toContain('pro_enabled')
    expect((w.find('[data-test="setting-value-pro_enabled"]').element as HTMLSelectElement).value).toBe('false')
  })

  it('ouvrir l’offre PRO : confirmation simple qui annonce les entrées PRO ET le retour des quotas', async () => {
    const w = mountForm()
    await w.find('[data-test="setting-value-pro_enabled"]').setValue('true')
    await w.find('[data-test="setting-save-pro_enabled"]').trigger('click')

    expect(w.find('[data-test="confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    expect(w.text()).toContain('Ouvrir l’offre PRO')
    expect(w.text()).toMatch(/quotas/)

    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['pro_enabled', 'true'])
  })

  it('fermer l’offre PRO : confirmation simple qui annonce le masquage ET la levée des quotas', async () => {
    const openPro: PlatformSetting = { ...pro, value: 'true' }
    const w = mountForm({ settings: [commission, urgency, cap, sms, openPro] })
    await w.find('[data-test="setting-value-pro_enabled"]').setValue('false')
    await w.find('[data-test="setting-save-pro_enabled"]').trigger('click')

    // Fermer ne bloque personne : pas de saisie de contrôle, contrairement aux SMS.
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    expect(w.text()).toContain('Fermer l’offre PRO')
    expect(w.text()).toMatch(/masquera/)
    expect(w.text()).toMatch(/quotas/)

    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['pro_enabled', 'false'])
  })

  it('flights_enabled porte un libellé lisible et un sélecteur Activé / Désactivé', () => {
    const w = mountForm({ settings: [flights] })
    const row = w.find('[data-test="setting-row-flights_enabled"]')
    expect(row.text()).toContain('Billets d’avion')
    expect(row.text()).not.toContain('flights_enabled')
    expect((w.find('[data-test="setting-value-flights_enabled"]').element as HTMLSelectElement).value).toBe('false')
  })

  it('traveler_status_required n’a plus de libellé dédié : la clé brute reste lisible', () => {
    const w = mountForm({ settings: [travelerStatusRequired] })
    const row = w.find('[data-test="setting-row-traveler_status_required"]')
    expect(row.text()).not.toContain('Statut de voyageur obligatoire pour publier')
    expect(row.text()).toContain('traveler_status_required')
  })

  it('activer les billets d’avion : confirmation simple qui annonce l’onglet et les six onglets', async () => {
    const w = mountForm({ settings: [flights] })
    await w.find('[data-test="setting-value-flights_enabled"]').setValue('true')
    await w.find('[data-test="setting-save-flights_enabled"]').trigger('click')

    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    expect(w.text()).toContain('Activer les billets d’avion')
    expect(w.text()).toMatch(/six onglets/)

    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['flights_enabled', 'true'])
  })

  it('désactiver les billets d’avion : rien n’est supprimé, la barre d’avant revient', async () => {
    const on: PlatformSetting = { ...flights, value: 'true' }
    const w = mountForm({ settings: [on] })
    await w.find('[data-test="setting-value-flights_enabled"]').setValue('false')
    await w.find('[data-test="setting-save-flights_enabled"]').trigger('click')

    expect(w.text()).toContain('Désactiver les billets d’avion')
    expect(w.text()).toMatch(/rien n’est supprimé/)

    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['flights_enabled', 'false'])
  })

  it('affiche les libellés et unités des réglages photos', () => {
    const w = mountForm({ settings: [retention, quota, maxTracking, purge] })
    expect(w.text()).toContain('Délai de suppression des photos après livraison')
    expect(w.find('[data-test="setting-unit-photo_retention_days_after_delivery"]').text()).toBe('jours')
    expect(w.text()).toContain('Photos envoyées par utilisateur et par jour')
    expect(w.text()).toContain('Photos de suivi par colis')
    expect(w.text()).toContain('Suppression des photos activée')
    expect(w.find('[data-test="setting-hint-photo_upload_daily_quota"]').text()).toBe('Entre 5 et 1000')
  })

  it.each([
    ['photo_retention_days_after_delivery', '0'], ['photo_retention_days_after_delivery', '366'],
    ['photo_upload_daily_quota', '4'], ['photo_upload_daily_quota', '1001'],
    ['tracking_photos_max_per_bid', '0'], ['tracking_photos_max_per_bid', '21'],
    ['photo_retention_days_after_delivery', '7.5'],
    ['photo_upload_daily_quota', ''],
    ['photo_upload_daily_quota', '1e1'],
    ['tracking_photos_max_per_bid', '1e1'],
  ])('refuse %s = "%s" hors bornes', async (key, value) => {
    const w = mountForm({ settings: [retention, quota, maxTracking] })
    await w.find(`[data-test="setting-value-${key}"]`).setValue(value)
    expect(w.find(`[data-test="setting-error-${key}"]`).exists()).toBe(true)
    expect(w.find(`[data-test="setting-save-${key}"]`).attributes('disabled')).toBeDefined()
    await w.find(`[data-test="setting-save-${key}"]`).trigger('click')
    expect(w.emitted('update')).toBeUndefined()
  })

  it('accepte les bornes incluses des réglages photos', async () => {
    const w = mountForm({ settings: [retention, quota, maxTracking] })
    await w.find('[data-test="setting-value-photo_upload_daily_quota"]').setValue('1000')
    expect(w.find('[data-test="setting-error-photo_upload_daily_quota"]').exists()).toBe(false)
    await w.find('[data-test="setting-value-tracking_photos_max_per_bid"]').setValue('1')
    expect(w.find('[data-test="setting-error-tracking_photos_max_per_bid"]').exists()).toBe(false)
  })

  it('l’aide « Entre X et Y » n’est pas doublée quand l’erreur hors bornes s’affiche', async () => {
    const w = mountForm({ settings: [retention] })
    const key = 'photo_retention_days_after_delivery'
    expect(w.find(`[data-test="setting-hint-${key}"]`).exists()).toBe(true)
    await w.find(`[data-test="setting-value-${key}"]`).setValue('0')
    expect(w.find(`[data-test="setting-error-${key}"]`).text()).toBe('Entre 1 et 365')
    expect(w.find(`[data-test="setting-hint-${key}"]`).exists()).toBe(false)
    expect(w.text().split('Entre 1 et 365')).toHaveLength(2)
  })

  it('l’avertissement d’activation de la purge est affiché en rouge', async () => {
    const w = mountForm({ settings: [purge] })
    await w.find('[data-test="setting-value-photo_purge_enabled"]').setValue('true')
    await w.find('[data-test="setting-save-photo_purge_enabled"]').trigger('click')
    const alert = w.find('[data-test="confirm-alert"]')
    expect(alert.classes()).toContain('text-danger')
    expect(alert.text()).toContain('supprimées définitivement de Cloudflare R2')
  })

  it('repasser à blanc n’affiche pas d’avertissement rouge', async () => {
    const w = mountForm({ settings: [{ ...purge, value: 'true' }] })
    await w.find('[data-test="setting-value-photo_purge_enabled"]').setValue('false')
    await w.find('[data-test="setting-save-photo_purge_enabled"]').trigger('click')
    expect(w.find('[data-test="confirm-alert"]').exists()).toBe(false)
  })

  it('activer la purge exige la phrase ACTIVER PURGE', async () => {
    const w = mountForm({ settings: [purge] })
    await w.find('[data-test="setting-value-photo_purge_enabled"]').setValue('true')
    await w.find('[data-test="setting-save-photo_purge_enabled"]').trigger('click')

    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(true)
    expect(w.text()).toContain('ACTIVER PURGE')
    expect(w.text()).toContain('Cloudflare R2')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)

    await w.find('[data-test="confirmation-input"]').setValue('DESACTIVER SMS')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.emitted('update')).toBeUndefined()

    await w.find('[data-test="confirmation-input"]').setValue('ACTIVER PURGE')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['photo_purge_enabled', 'true'])
  })

  it('repasser la purge à blanc : confirmation simple', async () => {
    const on: PlatformSetting = { ...purge, value: 'true' }
    const w = mountForm({ settings: [on] })
    await w.find('[data-test="setting-value-photo_purge_enabled"]').setValue('false')
    await w.find('[data-test="setting-save-photo_purge_enabled"]').trigger('click')

    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    expect(w.text()).toContain('repasse à blanc')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['photo_purge_enabled', 'false'])
  })

  it('les interrupteurs Route et Bateau ont un libellé lisible, pas leur clé brute', () => {
    const w = mountForm({ settings: [road, boat] })
    expect(w.find('[data-test="setting-row-transport_road_enabled"]').text()).toContain('Mode Route proposé dans l’application (voiture, car)')
    expect(w.find('[data-test="setting-row-transport_boat_enabled"]').text()).toContain('Mode Bateau proposé dans l’application (groupage maritime)')
    expect(w.text()).not.toContain('transport_road_enabled')
    expect(w.text()).not.toContain('transport_boat_enabled')
  })

  it('allumer la route demande une confirmation simple', async () => {
    const w = mountForm({ settings: [road] })
    await w.find('[data-test="setting-value-transport_road_enabled"]').setValue('true')
    await w.find('[data-test="setting-save-transport_road_enabled"]').trigger('click')
    expect(w.text()).toContain('Ouvrir le mode Route')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['transport_road_enabled', 'true'])
  })

  it('éteindre la route : confirmation simple, trajets existants gardés', async () => {
    const w = mountForm({ settings: [{ ...road, value: 'true' }] })
    await w.find('[data-test="setting-value-transport_road_enabled"]').setValue('false')
    await w.find('[data-test="setting-save-transport_road_enabled"]').trigger('click')
    expect(w.text()).toContain('Fermer le mode Route')
    expect(w.text()).toContain('restent en ligne')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['transport_road_enabled', 'false'])
  })

  it('allumer le bateau exige la phrase et rappelle les prérequis', async () => {
    const w = mountForm({ settings: [boat] })
    await w.find('[data-test="setting-value-transport_boat_enabled"]').setValue('true')
    await w.find('[data-test="setting-save-transport_boat_enabled"]').trigger('click')
    expect(w.text()).toContain('Ouvrir le mode Bateau')
    expect(w.text()).toContain('CGU')
    expect(w.text()).toContain('version minimale')
    expect(w.text()).toContain('OUVRIR LE BATEAU')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)

    await w.find('[data-test="confirmation-input"]').setValue('OUVRIR')
    expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.emitted('update')).toBeUndefined()

    await w.find('[data-test="confirmation-input"]').setValue('OUVRIR LE BATEAU')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['transport_boat_enabled', 'true'])
  })

  it('éteindre le bateau : confirmation simple, trajets existants gardés', async () => {
    const w = mountForm({ settings: [{ ...boat, value: 'true' }] })
    await w.find('[data-test="setting-value-transport_boat_enabled"]').setValue('false')
    await w.find('[data-test="setting-save-transport_boat_enabled"]').trigger('click')
    expect(w.text()).toContain('Fermer le mode Bateau')
    expect(w.text()).toContain('restent en ligne')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['transport_boat_enabled', 'false'])
  })

  it('le délai prévient qu’il s’applique aussi au chat', async () => {
    const w = mountForm({ settings: [retention] })
    await w.find('[data-test="setting-value-photo_retention_days_after_delivery"]').setValue('3')
    await w.find('[data-test="setting-save-photo_retention_days_after_delivery"]').trigger('click')

    expect(w.text()).toContain('photos du chat')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['photo_retention_days_after_delivery', '3'])
  })

  it('les commandes sont désactivées pendant l’appel (busy)', () => {
    const w = mountForm({ busy: true })
    expect((w.find('[data-test="setting-value-commission_rate"]').element as HTMLInputElement).disabled).toBe(true)
    expect((w.find('[data-test="setting-value-sms_enabled"]').element as HTMLSelectElement).disabled).toBe(true)
    expect((w.find('[data-test="setting-save-commission_rate"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('[data-test="setting-save-sms_enabled"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('affiche les quotas de l’assistant avec un libellé lisible, leur unité et leurs bornes', () => {
    const w = mountForm({ settings: [assistantQuota, formDraftQuota] })
    expect(w.text()).toContain('Questions à l’assistant d’aide par utilisateur et par jour')
    expect(w.text()).toContain('Tours de remplissage par l’IA (trajet et colis) par utilisateur et par jour')
    expect(w.find('[data-test="setting-unit-assistant_daily_quota"]').text()).toBe('questions')
    expect(w.find('[data-test="setting-unit-assistant_form_draft_daily_quota"]').text()).toBe('tours')
    expect(w.find('[data-test="setting-hint-assistant_daily_quota"]').text()).toBe('Entre 1 et 1000')
    expect(w.find('[data-test="setting-hint-assistant_form_draft_daily_quota"]').text()).toBe('Entre 1 et 1000')
  })

  it.each([
    ['assistant_daily_quota', '0'], ['assistant_daily_quota', '1001'], ['assistant_daily_quota', '2.5'],
    ['assistant_form_draft_daily_quota', '0'], ['assistant_form_draft_daily_quota', '1001'],
    ['assistant_form_draft_daily_quota', ''],
  ])('refuse le quota %s = "%s" hors bornes, sans appel réseau', async (key, value) => {
    const w = mountForm({ settings: [assistantQuota, formDraftQuota] })
    await w.find(`[data-test="setting-value-${key}"]`).setValue(value)
    expect(w.find(`[data-test="setting-error-${key}"]`).exists()).toBe(true)
    await w.find(`[data-test="setting-save-${key}"]`).trigger('click')
    expect(w.emitted('update')).toBeUndefined()
  })

  it('accepte les bornes incluses des quotas de l’assistant', async () => {
    const w = mountForm({ settings: [assistantQuota, formDraftQuota] })
    await w.find('[data-test="setting-value-assistant_daily_quota"]').setValue('1')
    expect(w.find('[data-test="setting-error-assistant_daily_quota"]').exists()).toBe(false)
    await w.find('[data-test="setting-value-assistant_form_draft_daily_quota"]').setValue('1000')
    expect(w.find('[data-test="setting-error-assistant_form_draft_daily_quota"]').exists()).toBe(false)
  })

  describe('fréquence de lecture de Remote Config', () => {
    const k = 'remote_config_fetch_minutes'

    it('affiche le libellé, l’unité, l’aide et les bornes', () => {
      const w = mountForm({ settings: [remoteConfigFetch] })
      expect(w.text()).toContain('Fréquence de mise à jour de la configuration de l’app (bandeau de mise à jour, centre d’aide)')
      expect(w.find(`[data-test="setting-unit-${k}"]`).text()).toBe('minutes')
      expect(w.find(`[data-test="setting-help-${k}"]`).text()).toContain('60 = une heure')
      expect(w.find(`[data-test="setting-help-${k}"]`).text()).toContain('100 000 par jour')
      expect(w.find(`[data-test="setting-hint-${k}"]`).text()).toBe('Entre 5 et 1440')
    })

    it.each(['4', '1441', '2.5', '', '1e2'])('refuse « %s » sans appel réseau', async (value) => {
      const w = mountForm({ settings: [remoteConfigFetch] })
      await w.find(`[data-test="setting-value-${k}"]`).setValue(value)
      expect(w.find(`[data-test="setting-error-${k}"]`).exists()).toBe(true)
      await w.find(`[data-test="setting-save-${k}"]`).trigger('click')
      expect(w.emitted('update')).toBeUndefined()
    })

    it.each(['5', '1440'])('accepte la borne %s', async (value) => {
      const w = mountForm({ settings: [remoteConfigFetch] })
      await w.find(`[data-test="setting-value-${k}"]`).setValue(value)
      expect(w.find(`[data-test="setting-error-${k}"]`).exists()).toBe(false)
    })

    it('envoie la valeur saisie telle quelle', async () => {
      const w = mountForm({ settings: [remoteConfigFetch] })
      await w.find(`[data-test="setting-value-${k}"]`).setValue('120')
      await w.find(`[data-test="setting-save-${k}"]`).trigger('click')
      const confirm = w.findComponent({ name: 'ConfirmActionDialog' })
      if (confirm.exists()) confirm.vm.$emit('confirm')
      await w.vm.$nextTick()
      expect(w.emitted('update')?.[0]).toEqual([k, '120'])
    })

    it('clé absente du back : la page s’affiche sans cette carte', () => {
      const w = mountForm()
      expect(w.find(`[data-test="setting-value-${k}"]`).exists()).toBe(false)
    })
  })

  describe('commission par paliers (onglet Tarification)', () => {
    it('sans grille : le champ du taux unique reste, avec un lien vers l’onglet', () => {
      const w = mountForm()
      expect(w.find('[data-test="setting-value-commission_rate"]').exists()).toBe(true)
      expect(w.find('[data-test="setting-commission-managed"]').exists()).toBe(false)
      const link = w.find('[data-test="setting-commission-link"] a')
      expect(link.attributes('href')).toBe('/tarification')
    })

    it('grille en vigueur : renvoi vers l’onglet au lieu du champ, les autres réglages intacts', () => {
      const w = mountForm({ commissionGridActive: true })
      expect(w.find('[data-test="setting-value-commission_rate"]').exists()).toBe(false)
      expect(w.find('[data-test="setting-save-commission_rate"]').exists()).toBe(false)
      expect(w.find('[data-test="setting-commission-link"]').exists()).toBe(false)
      const managed = w.find('[data-test="setting-commission-managed"]')
      expect(managed.text()).toContain('Commission gérée dans l’onglet')
      expect(managed.find('a').attributes('href')).toBe('/tarification')
      expect(w.find('[data-test="setting-value-urgency_threshold_days"]').exists()).toBe(true)
    })

    it('statut de la grille inconnu : ni champ ni lien, une attente ; les autres réglages intacts', () => {
      const w = mountForm({ commissionGridActive: null })
      expect(w.find('[data-test="setting-commission-pending"]').text()).toBe('Chargement…')
      expect(w.find('[data-test="setting-value-commission_rate"]').exists()).toBe(false)
      expect(w.find('[data-test="setting-commission-link"]').exists()).toBe(false)
      expect(w.find('[data-test="setting-commission-managed"]').exists()).toBe(false)
      expect(w.find('[data-test="setting-error-commission_rate"]').exists()).toBe(false)
      expect(w.find('[data-test="setting-value-urgency_threshold_days"]').exists()).toBe(true)
    })
  })

  describe('pays sans SMS (sms_blocked_country_codes, type CALLING_CODES)', () => {
    // Indicatifs bloqués : les SMS vers ces pays étaient facturés sans arriver (faux « Delivered », 08/11/2026).
    const blocked: PlatformSetting = {
      key: 'sms_blocked_country_codes', value: '225,221', type: 'CALLING_CODES',
      updatedAt: null, updatedByEmail: null,
    }
    const rowKeys = (w: ReturnType<typeof mountForm>) =>
      w.findAll('[data-test^="setting-row-"]').map((r) => r.attributes('data-test')!.replace('setting-row-', ''))
    const saveBtn = (w: ReturnType<typeof mountForm>) =>
      w.find('[data-test="setting-save-sms_blocked_country_codes"]').element as HTMLButtonElement

    it('porte un libellé lisible, une explication et une puce par pays, sans champ numérique', () => {
      const w = mountForm({ settings: [blocked] })
      const row = w.find('[data-test="setting-row-sms_blocked_country_codes"]')
      expect(row.text()).toContain('Pays sans SMS (indicatifs bloqués)')
      expect(w.find('[data-test="setting-help-sms_blocked_country_codes"]').text()).toContain('email, Google ou Apple')
      expect(w.find('[data-test="calling-code-chip-225"]').text()).toBe('+225 Côte d’Ivoire')
      expect(w.find('[data-test="calling-code-chip-221"]').text()).toBe('+221 Sénégal')
      expect(w.find('[data-test="setting-value-sms_blocked_country_codes"]').exists()).toBe(false)
    })

    it('est rangé juste après le dernier réglage sms_*, quel que soit l’ordre servi par le back', () => {
      const w = mountForm({ settings: [blocked, commission, sms, smsRegisteredOnly, pro] })
      expect(rowKeys(w)).toEqual([
        'commission_rate', 'sms_enabled', 'sms_otp_registered_numbers_only', 'sms_blocked_country_codes', 'pro_enabled',
      ])
      // Sans autre réglage SMS, l'ordre du back est gardé tel quel.
      expect(rowKeys(mountForm({ settings: [blocked, commission] }))).toEqual(['sms_blocked_country_codes', 'commission_rate'])
    })

    it('rien à enregistrer tant que la liste n’a pas changé (valeur servie avec « + » et espaces comprise)', async () => {
      const w = mountForm({ settings: [{ ...blocked, value: '+225, 221' }] })
      expect(saveBtn(w).disabled).toBe(true)
      await w.find('[data-test="setting-save-sms_blocked_country_codes"]').trigger('click')
      expect(w.find('[data-test="confirm"]').exists()).toBe(false)
    })

    it('ajouter un pays : confirmation simple, sans avertissement, puis envoie la chaîne normalisée', async () => {
      const w = mountForm({ settings: [blocked] })
      await w.find('[data-test="calling-code-input"]').setValue('+237')
      await w.find('[data-test="calling-code-add"]').trigger('click')
      expect(w.find('[data-test="calling-code-chip-237"]').text()).toBe('+237 Cameroun')
      expect(saveBtn(w).disabled).toBe(false)

      await w.find('[data-test="setting-save-sms_blocked_country_codes"]').trigger('click')
      expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
      expect(w.find('[data-test="confirm-alert"]').exists()).toBe(false)
      expect(w.text()).toContain('Bloquer les SMS vers ce pays')
      expect(w.text()).toContain('+237 Cameroun')
      expect(w.find('[data-test="confirm"]').text()).toBe('Bloquer')

      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('update')![0]).toEqual(['sms_blocked_country_codes', '225,221,237'])
    })

    it('retirer un pays : l’avertissement rappelle que ces SMS sont facturés et n’arrivaient pas, sans phrase à taper', async () => {
      const w = mountForm({ settings: [blocked] })
      await w.find('[data-test="calling-code-remove-225"]').trigger('click')
      await w.find('[data-test="setting-save-sms_blocked_country_codes"]').trigger('click')

      const alert = w.find('[data-test="confirm-alert"]').text()
      expect(alert).toContain('facturés')
      expect(alert).toContain('Delivered')
      expect(alert).toContain('08/11/2026')
      expect(w.text()).toContain('Les SMS repartiront vers : +225 Côte d’Ivoire.')
      expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
      expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(false)
      expect(w.find('[data-test="confirm"]').text()).toBe('Rouvrir les SMS')

      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('update')![0]).toEqual(['sms_blocked_country_codes', '221'])
    })

    it('vider la liste, ou retirer et ajouter à la fois, garde l’avertissement et dit les deux changements', async () => {
      const w = mountForm({ settings: [blocked] })
      await w.find('[data-test="calling-code-remove-225"]').trigger('click')
      await w.find('[data-test="calling-code-remove-221"]').trigger('click')
      await w.find('[data-test="calling-code-input"]').setValue('33')
      await w.find('[data-test="calling-code-add"]').trigger('click')
      await w.find('[data-test="setting-save-sms_blocked_country_codes"]').trigger('click')

      expect(w.text()).toContain('Rouvrir les SMS vers 2 pays')
      expect(w.text()).toContain('+33 France')
      expect(w.find('[data-test="confirm-alert"]').exists()).toBe(true)
      await w.find('[data-test="cancel"]').trigger('click')
      expect(w.emitted('update')).toBeUndefined()
    })

    it('ajouter plusieurs pays d’un coup (liste Afrique) : titre au pluriel', async () => {
      const w = mountForm({ settings: [{ ...blocked, value: '' }] })
      expect(w.find('[data-test="calling-codes-empty"]').exists()).toBe(true)
      await w.find('[data-test="calling-code-reset-africa"]').trigger('click')
      await w.find('[data-test="setting-save-sms_blocked_country_codes"]').trigger('click')
      expect(w.text()).toContain('Bloquer les SMS vers 18 pays')
      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('update')![0]![1]).toBe('212,213,216,221,222,223,224,225,226,227,228,229,235,236,237,241,242,243')
    })

    it('une valeur invalide servie par le back est signalée et ne s’enregistre pas', () => {
      const w = mountForm({ settings: [{ ...blocked, value: '225,abc' }] })
      expect(w.find('[data-test="setting-error-sms_blocked_country_codes"]').text()).toContain('abc')
      expect(saveBtn(w).disabled).toBe(true)
    })

    it('un type inconnu du front ne fait pas planter la page : champ numérique par défaut', () => {
      const odd = { key: 'future_setting', value: '7', type: 'SOMETHING_NEW', updatedAt: null, updatedByEmail: null } as unknown as PlatformSetting
      const w = mountForm({ settings: [odd, blocked] })
      expect(w.find('[data-test="setting-value-future_setting"]').exists()).toBe(true)
      expect(w.find('[data-test="calling-code-chip-225"]').exists()).toBe(true)
    })
  })

  describe('seuil d’alerte des particuliers (individual_trips_alert_threshold)', () => {
    const threshold: PlatformSetting = {
      key: 'individual_trips_alert_threshold', value: '4', type: 'INTEGER', updatedAt: null, updatedByEmail: null,
    }

    it('porte un libellé lisible, son unité, ses bornes 1 à 100 et son aide', () => {
      const w = mountForm({ settings: [threshold] })
      const row = w.find('[data-test="setting-row-individual_trips_alert_threshold"]')
      expect(row.text()).toContain('Trajets publiés par mois avant alerte (voyageur Particulier)')
      expect(row.text()).not.toContain('individual_trips_alert_threshold')
      expect(w.find('[data-test="setting-unit-individual_trips_alert_threshold"]').text()).toBe('trajets')
      expect(w.find('[data-test="setting-hint-individual_trips_alert_threshold"]').text()).toBe('Entre 1 et 100')
      expect(w.find('[data-test="setting-help-individual_trips_alert_threshold"]').text()).toBe(
        'Un particulier qui publie plus de ce nombre de trajets dans le mois civil est signalé à l’équipe (aucun blocage, aucune sanction).',
      )
    })

    it('refuse 0 et 101 sans appel réseau, accepte 1 et 100', async () => {
      const w = mountForm({ settings: [threshold] })
      const input = w.find('[data-test="setting-value-individual_trips_alert_threshold"]')
      const save = () => w.find('[data-test="setting-save-individual_trips_alert_threshold"]').element as HTMLButtonElement
      for (const bad of ['0', '101', '', '4.5']) {
        await input.setValue(bad)
        expect(save().disabled).toBe(true)
        expect(w.find('[data-test="setting-error-individual_trips_alert_threshold"]').text()).toBe('Entre 1 et 100')
      }
      for (const good of ['1', '100']) {
        await input.setValue(good)
        expect(save().disabled).toBe(false)
      }
    })

    it('enregistre la valeur saisie après confirmation', async () => {
      const w = mountForm({ settings: [threshold] })
      await w.find('[data-test="setting-value-individual_trips_alert_threshold"]').setValue('6')
      await w.find('[data-test="setting-save-individual_trips_alert_threshold"]').trigger('click')
      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('update')![0]).toEqual(['individual_trips_alert_threshold', '6'])
    })
  })
})
