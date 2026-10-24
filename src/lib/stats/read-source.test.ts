import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STATS_READ_SOURCE,
  STATS_READ_SOURCE_ENV,
  resolveReadSource,
  type StatsReadSource,
} from './read-source'

describe('read-source v384 saklar sumber baca', () => {
  it('kontrak nama env dan default', () => {
    expect(STATS_READ_SOURCE_ENV).toBe('STATS_READ_SOURCE')
    expect(DEFAULT_STATS_READ_SOURCE).toBe<StatsReadSource>('entity')
  })

  it('undefined dan kosong jatuh ke default entity', () => {
    expect(resolveReadSource(undefined)).toBe('entity')
    expect(resolveReadSource('')).toBe('entity')
  })

  it('legacy dipilih persis', () => {
    expect(resolveReadSource('legacy')).toBe('legacy')
  })

  it('nilai tidak dikenal selalu jatuh ke entity (salah ketik env tidak mematikan route)', () => {
    expect(resolveReadSource('Entity')).toBe('entity')
    expect(resolveReadSource('LEGACY')).toBe('entity')
    expect(resolveReadSource('postgres')).toBe('entity')
    expect(resolveReadSource('entity ')).toBe('entity')
  })
})
