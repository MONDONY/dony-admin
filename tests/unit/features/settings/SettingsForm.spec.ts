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

function mountForm(props: Partial<InstanceType<typeof SettingsForm>['$props']> = {}) {
  return mount(SettingsForm, {
    props: { settings: [commission, urgency, cap, sms], busy: false, ...props },
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

  it('les commandes sont désactivées pendant l’appel (busy)', () => {
    const w = mountForm({ busy: true })
    expect((w.find('[data-test="setting-value-commission_rate"]').element as HTMLInputElement).disabled).toBe(true)
    expect((w.find('[data-test="setting-value-sms_enabled"]').element as HTMLSelectElement).disabled).toBe(true)
    expect((w.find('[data-test="setting-save-commission_rate"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('[data-test="setting-save-sms_enabled"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})
