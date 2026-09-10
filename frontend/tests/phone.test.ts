import { describe, expect, it } from 'vitest'
import { combinePhone, normalizeNational } from '../src/lib/phone'

describe('normalizeNational', () => {
  it('strips non-digit characters', () => {
    expect(normalizeNational('+233', '317-144-161 ')).toBe('317144161')
  })

  it('drops a leading zero for default countries', () => {
    expect(normalizeNational('+233', '02317144161')).toBe('2317144161')
    expect(normalizeNational('+234', '08012345678')).toBe('8012345678')
  })

  it('keeps a leading zero for keepZero countries', () => {
    expect(normalizeNational('+225', '07123456')).toBe('07123456')
    expect(normalizeNational('+229', '011223344')).toBe('011223344')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeNational('+233', '')).toBe('')
    expect(normalizeNational('+233', null)).toBe('')
  })
})

describe('combinePhone', () => {
  it('builds the full E.164 number', () => {
    expect(combinePhone('+233', '317 144 161')).toBe('+233317144161')
  })

  it('normalizes the national part before combining', () => {
    expect(combinePhone('+234', '08012345678')).toBe('+2348012345678')
  })

  it('preserves the leading zero for keepZero countries', () => {
    expect(combinePhone('+225', '07123456')).toBe('+22507123456')
  })
})
