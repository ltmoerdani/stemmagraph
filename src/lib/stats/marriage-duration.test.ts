import { describe, expect, it } from 'vitest'
import {
  parseMarriageDurationFamilies,
} from './marriage-duration'

describe('marriage duration extremes (v331 fase i)', () => {
  it('kasus 0 (skeleton): payload array kosong menghasilkan array kosong', () => {
    expect(parseMarriageDurationFamilies([])).toEqual([])
    expect(parseMarriageDurationFamilies('[]')).toEqual([])
  })
})
