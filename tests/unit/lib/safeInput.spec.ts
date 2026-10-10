import { describe, it, expect } from 'vitest'
import { firestoreIdParam, isUuid, safeHttpsUrl, uuidParam } from '@/lib/safeInput'

describe('safeInput', () => {
  it('UUID : seul un identifiant valide passe', () => {
    expect(isUuid('db1c5742-1a56-4a66-a729-47ab29987b32')).toBe(true)
    expect(uuidParam('DB1C5742-1A56-4A66-A729-47AB29987B32')).toBe('DB1C5742-1A56-4A66-A729-47AB29987B32')
    for (const bad of ['../../admin/x', 'db1c5742-1a56-4a66-a729-47ab29987b32/../x', '', 'b1', ['x'], undefined, null, 42]) {
      expect(uuidParam(bad)).toBeNull()
    }
  })
  it('identifiant Firestore : ni barre oblique, ni point, ni encodage', () => {
    expect(firestoreIdParam('a1B2_c3-D4')).toBe('a1B2_c3-D4')
    for (const bad of ['../../admin/x', 'a/b', 'a%2Fb', 'a.b', '', 'x'.repeat(129), undefined, ['a']]) {
      expect(firestoreIdParam(bad)).toBeNull()
    }
  })
  it('URL : https seulement', () => {
    expect(safeHttpsUrl('https://r2.test/p.jpg?sig=1')).toBe('https://r2.test/p.jpg?sig=1')
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>',
      'http://r2.test/p.jpg', '//evil.test/p.jpg', 'tracking/b1/1_DEPART.jpg', '', null, undefined, 3]) {
      expect(safeHttpsUrl(bad)).toBeNull()
    }
  })
})
