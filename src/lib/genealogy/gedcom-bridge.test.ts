import { describe, it, expect } from 'vitest'
import { datePayloadFromGed, sexFromGender, roundTripFromGed } from './gedcom-bridge'

describe('gedcom-bridge (pure)', () => {
  describe('datePayloadFromGed', () => {
    it('parses exact year', () => {
      const r = datePayloadFromGed('1900')
      expect(r).not.toBeNull()
      expect(r?.modifier).toBe('exact')
      expect(r?.year).toBe(1900)
    })

    it('parses FROM-TO period', () => {
      const r = datePayloadFromGed('FROM 1900 TO 1910')
      expect(r?.modifier).toBe('from')
      expect(r?.year).toBe(1900)
      expect(r?.year2).toBe(1910)
    })

    it('parses BET-AND range', () => {
      const r = datePayloadFromGed('BET 1900 AND 1910')
      expect(r?.modifier).toBe('range')
      expect(r?.year).toBe(1900)
      expect(r?.year2).toBe(1910)
    })

    it('parses ABT/CAL/EST with distinct modifiers', () => {
      expect(datePayloadFromGed('ABT 1850')?.modifier).toBe('about')
      expect(datePayloadFromGed('CAL 1875')?.modifier).toBe('calculated')
      expect(datePayloadFromGed('EST 1850')?.modifier).toBe('estimated')
    })

    it('keeps free text phrase intact', () => {
      const r = datePayloadFromGed('sekitar tahun kemerdekaan')
      expect(r?.modifier).toBe('exact')
      expect(r?.phrase).toBe('sekitar tahun kemerdekaan')
    })

    it('returns null for invalid payload without throwing', () => {
      expect(datePayloadFromGed('')).toBeNull()
      expect(datePayloadFromGed('   ')).toBeNull()
      expect(datePayloadFromGed(null)).toBeNull()
      expect(datePayloadFromGed(undefined)).toBeNull()
    })
  })

  describe('sexFromGender', () => {
    it('maps M/F directly', () => {
      expect(sexFromGender('M')).toBe('M')
      expect(sexFromGender('F')).toBe('F')
    })

    it('normalizes long form words', () => {
      expect(sexFromGender('male')).toBe('M')
      expect(sexFromGender('female')).toBe('F')
      expect(sexFromGender('nonbinary')).toBe('X')
    })

    it('falls back to U for unknown input', () => {
      expect(sexFromGender('X')).toBe('X')
      expect(sexFromGender('alien')).toBe('U')
      expect(sexFromGender(null)).toBe('U')
      expect(sexFromGender(undefined)).toBe('U')
    })
  })

  describe('roundTripFromGed (identity exact)', () => {
    it('exact year returns identical string', () => {
      expect(roundTripFromGed('1945')).toBe('1945')
    })

    it('FROM-TO returns identical string', () => {
      expect(roundTripFromGed('FROM 1900 TO 1910')).toBe('FROM 1900 TO 1910')
    })

    it('BET-AND returns identical string', () => {
      expect(roundTripFromGed('BET 1900 AND 1910')).toBe('BET 1900 AND 1910')
    })

    it('ABT/CAL/EST return identical strings', () => {
      expect(roundTripFromGed('ABT 1850')).toBe('ABT 1850')
      expect(roundTripFromGed('CAL 1875')).toBe('CAL 1875')
      expect(roundTripFromGed('EST 1900')).toBe('EST 1900')
    })

    it('phrase with spaces returns trimmed identical text', () => {
      expect(roundTripFromGed('  sekitar tahun kemerdekaan  ')).toBe('sekitar tahun kemerdekaan')
    })

    it('BET-AND and FROM-TO are not swapped', () => {
      expect(roundTripFromGed('FROM 1800 TO 1850')).toBe('FROM 1800 TO 1850')
      expect(roundTripFromGed('BET 1800 AND 1850')).toBe('BET 1800 AND 1850')
      expect(roundTripFromGed('BET 1800 AND 1850')).not.toBe('FROM 1800 TO 1850')
    })

    it('ABT vs CAL vs EST differ in modifier (quality axis)', () => {
      expect(roundTripFromGed('ABT 1900')).not.toBe('CAL 1900')
      expect(roundTripFromGed('CAL 1900')).not.toBe('EST 1900')
    })

    it('returns null for empty or whitespace input', () => {
      expect(roundTripFromGed('')).toBeNull()
      expect(roundTripFromGed('   ')).toBeNull()
      expect(roundTripFromGed(null)).toBeNull()
    })
  })
})
