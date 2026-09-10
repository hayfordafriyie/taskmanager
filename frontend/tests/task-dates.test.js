import { describe, expect, it } from 'vitest'
import {
  buildDatePayload,
  formatWindow,
  isWindowReversed,
  toDateInput,
  toIsoDate,
} from '../src/modules/tasks/dates'

describe('task date helpers', () => {
  it('converts an RFC3339 value from the API into a date-input value', () => {
    expect(toDateInput('2026-09-15T00:00:00Z')).toBe('2026-09-15')
    expect(toDateInput(null)).toBe('')
    expect(toDateInput(undefined)).toBe('')
  })

  it('converts a date-input value into RFC3339 midnight UTC', () => {
    expect(toIsoDate('2026-09-15')).toBe('2026-09-15T00:00:00.000Z')
    expect(toIsoDate('')).toBeNull()
    expect(toIsoDate('   ')).toBeNull()
    expect(toIsoDate('not-a-date')).toBeNull()
  })

  it('round-trips a date without drifting a day', () => {
    const iso = toIsoDate('2026-01-01')
    expect(toDateInput(iso)).toBe('2026-01-01')
  })

  it('detects a reversed window but allows an open or empty one', () => {
    expect(isWindowReversed('2026-09-20', '2026-09-01')).toBe(true)
    expect(isWindowReversed('2026-09-01', '2026-09-20')).toBe(false)
    expect(isWindowReversed('2026-09-01', '2026-09-01')).toBe(false)
    expect(isWindowReversed('', '2026-09-20')).toBe(false)
    expect(isWindowReversed('2026-09-01', '')).toBe(false)
    expect(isWindowReversed('', '')).toBe(false)
  })

  it('labels a full, partial and empty window', () => {
    expect(formatWindow('2026-09-15T00:00:00Z', '2026-09-20T00:00:00Z')).toBe('15 Sep → 20 Sep')
    expect(formatWindow('2026-09-15T00:00:00Z', null)).toBe('Starts 15 Sep')
    expect(formatWindow(null, '2026-09-20T00:00:00Z')).toBe('Ends 20 Sep')
    expect(formatWindow(null, null)).toBe('')
  })

  it('sends both dates on create without clear flags', () => {
    expect(buildDatePayload({ start: '2026-09-15', end: '2026-09-20' })).toEqual({
      startDate: '2026-09-15T00:00:00.000Z',
      endDate: '2026-09-20T00:00:00.000Z',
    })
  })

  it('flags a blanked date for clearing when editing', () => {
    const payload = buildDatePayload({
      start: '',
      end: '2026-09-20',
      previous: { startDate: '2026-09-15T00:00:00Z', endDate: '2026-09-18T00:00:00Z' },
      isEdit: true,
    })
    expect(payload.startDate).toBeNull()
    expect(payload.clearStartDate).toBe(true)
    expect(payload.endDate).toBe('2026-09-20T00:00:00.000Z')
    // the end date still has a value, so it must not be cleared
    expect(payload.clearEndDate).toBeUndefined()
  })

  it('does not flag a clear for dates that were never set', () => {
    const payload = buildDatePayload({
      start: '',
      end: '',
      previous: { startDate: null, endDate: null },
      isEdit: true,
    })
    expect(payload.clearStartDate).toBeUndefined()
    expect(payload.clearEndDate).toBeUndefined()
  })
})
