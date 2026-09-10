import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PasswordInput from '../src/components/PasswordInput'

describe('PasswordInput', () => {
  it('renders a masked password field by default', () => {
    render(<PasswordInput value="hunter2" onChange={() => {}} placeholder="Password" />)
    const input = screen.getByPlaceholderText('Password')
    expect(input).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
  })

  it('reveals and hides the password via the eye toggle', async () => {
    const user = userEvent.setup()
    render(<PasswordInput value="hunter2" onChange={() => {}} placeholder="Password" />)
    const input = screen.getByPlaceholderText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input).toHaveAttribute('type', 'password')
  })
})
