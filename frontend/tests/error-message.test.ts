import { describe, expect, it } from 'vitest'
import { errorMessage } from '../src/lib/errors'

describe('errorMessage', () => {
  it('prefers the server reason over the generic fallback', () => {
    expect(errorMessage({ errors: [{ message: 'Passwords do not match' }] }, 'Failed to create account')).toBe(
      'Passwords do not match',
    )
  })

  it('reads a plain Error, a string, and a graphQLErrors wrapper', () => {
    expect(errorMessage(new Error('password must be at least 8 characters'))).toBe(
      'password must be at least 8 characters',
    )
    expect(errorMessage('phone already registered')).toBe('phone already registered')
    expect(errorMessage({ graphQLErrors: [{ message: 'invalid code' }] })).toBe('invalid code')
  })

  it('nests through response.errors and picks the first real message', () => {
    expect(errorMessage({ response: { errors: [{ message: 'team not found' }] } })).toBe('team not found')
    expect(errorMessage({ errors: [{ message: '   ' }, { message: 'second' }] })).toBe('second')
  })

  it('falls back only when the server said nothing usable', () => {
    expect(errorMessage(null, 'Failed to save')).toBe('Failed to save')
    expect(errorMessage({}, 'Failed to save')).toBe('Failed to save')
    expect(errorMessage({ errors: [] }, 'Failed to save')).toBe('Failed to save')
  })
})
