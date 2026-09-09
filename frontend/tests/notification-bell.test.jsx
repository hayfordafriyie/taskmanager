import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationBell from '../src/components/NotificationBell'

describe('NotificationBell', () => {
  it('shows the bell with an unread count badge', () => {
    render(<NotificationBell />)
    expect(
      screen.getByRole('button', { name: 'Notifications (3 unread)' }),
    ).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('opens the drawer on click and closes it on a second click', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)
    const bell = screen.getByRole('button', { name: 'Notifications (3 unread)' })
    expect(bell).toHaveAttribute('aria-expanded', 'false')
    await user.click(bell)
    expect(bell).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('New invite')).toBeInTheDocument()
    await user.click(bell)
    expect(bell).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('New invite')).not.toBeInTheDocument()
  })
})