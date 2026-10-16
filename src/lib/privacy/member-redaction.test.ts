import { describe, expect, it } from 'vitest'
import { applyMemberVisibility, redactMember } from './member-redaction'
import type { RedactableMember } from './member-redaction'

/**
 * v261-i privacy read wiring: redaksi anggota berdasarkan visibilitas
 * relasi. Aturan berurutan v260-i: self > deceased > consent shared >
 * kerabat inti name-only > sisanya hidden. Bentuk name-only subset
 * eksak; hidden null; full mengembalikan objek input utuh.
 */

function member(overrides: Partial<RedactableMember> = {}): RedactableMember {
  return {
    id: 'm1',
    treeId: 't1',
    name: 'Budi',
    isAlive: true,
    privacyStatus: null,
    generation: 2,
    gender: 'male',
    ...overrides,
  } as RedactableMember
}

const NAME_ONLY_KEYS = ['id', 'treeId', 'name', 'isAlive', 'generation', 'gender']

describe('member-redaction applyMemberVisibility (v261-i)', () => {
  it('1. aturan 1: self SELALU full, objek input utuh tanpa redaksi', () => {
    const m = member({ privacyStatus: 'private' })
    const out = applyMemberVisibility(m, 'self')
    expect(out).toBe(m)
  })

  it('2. aturan 2: deceased SELALU full bahkan saat other dan private', () => {
    const m = member({ isAlive: false, privacyStatus: 'private' })
    expect(applyMemberVisibility(m, 'other')).toBe(m)
  })

  it('3. aturan 3: consent shared SELALU full pada living non-self', () => {
    const m = member({ privacyStatus: 'shared' })
    expect(applyMemberVisibility(m, 'other')).toBe(m)
  })

  it('4. aturan 4: living private, kerabat inti partner = name-only subset eksak', () => {
    const out = applyMemberVisibility(member({ privacyStatus: 'private' }), 'partner')
    expect(out).not.toBeNull()
    expect(Object.keys(out as object).sort()).toEqual([...NAME_ONLY_KEYS].sort())
    expect(out).toMatchObject({ id: 'm1', treeId: 't1', name: 'Budi', isAlive: true, generation: 2, gender: 'male' })
  })

  it('5. aturan 4: living private, child = name-only', () => {
    const out = applyMemberVisibility(member(), 'child')
    expect(out).toMatchObject({ name: 'Budi', generation: 2 })
    expect(out).not.toHaveProperty('nickname')
  })

  it('6. aturan 4: living private, parent = name-only', () => {
    const out = applyMemberVisibility(member(), 'parent')
    expect(out).not.toBeNull()
    expect((out as { name: string }).name).toBe('Budi')
  })

  it('7. aturan 4: living private, sibling = hidden null', () => {
    expect(applyMemberVisibility(member(), 'sibling')).toBeNull()
  })

  it('8. aturan 4: living TANPA status (null) = hidden untuk other', () => {
    expect(applyMemberVisibility(member({ privacyStatus: null }), 'other')).toBeNull()
  })

  it('9. aturan 4: living status tak dikenal diperlakukan private, hidden utk other', () => {
    expect(applyMemberVisibility(member({ privacyStatus: 'weird' as string }), 'other')).toBeNull()
  })

  it('10. kombinasi: living private, generation dan gender nihil tetap name-only lengkap dengan null', () => {
    const out = applyMemberVisibility(member({ generation: null, gender: null }), 'partner')
    expect(out).toMatchObject({ generation: null, gender: null, name: 'Budi' })
  })

  it('11. kombinasi: deceased menang atas hidden relasi sibling', () => {
    const m = member({ isAlive: false })
    expect(applyMemberVisibility(m, 'sibling')).toBe(m)
  })

  it('12. kombinasi: consent shared menang atas relasi sibling pada living', () => {
    const m = member({ privacyStatus: 'shared' })
    expect(applyMemberVisibility(m, 'sibling')).toBe(m)
  })

  it('13. redactMember eksplisit: full = objek input, hidden = null', () => {
    const m = member()
    expect(redactMember(m, 'full')).toBe(m)
    expect(redactMember(m, 'hidden')).toBeNull()
  })

  it('14. redactMember name-only: subset eksak enam field, field lain terbuang', () => {
    const out = redactMember(member(), 'name-only')
    expect(Object.keys(out as object).sort()).toEqual([...NAME_ONLY_KEYS].sort())
  })
})
