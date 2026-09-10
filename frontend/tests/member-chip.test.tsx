import { describe, expect, it } from 'vitest'
import { initialsOf, personName } from '../src/modules/home/people'

describe('member name helpers', () => {
  it('builds a full name from the parts', () => {
    expect(personName({ firstName: 'Kwabena', surname: 'Nkrumah-Agyeman' })).toBe('Kwabena Nkrumah-Agyeman')
    expect(personName({ firstName: 'Ama' })).toBe('Ama')
    expect(personName(null)).toBe('')
  })

  it('builds initials for the card avatar', () => {
    expect(initialsOf({ firstName: 'Kwabena', surname: 'Nkrumah-Agyeman' })).toBe('KN')
    expect(initialsOf({ firstName: 'Ama' })).toBe('A')
    expect(initialsOf(null)).toBe('?')
  })
})
