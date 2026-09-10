import { describe, expect, it, vi } from 'vitest'
import { useRef, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDismissOnOutside } from '../src/hooks/useDismiss'
import { NotificationBell } from '../src/components/NotificationBell'

vi.mock('../src/modules/notifications/hooks', () => ({
  useNotifications: () => ({ data: [] }),
  useUnreadNotificationCount: () => ({ data: 0 }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkNotificationUnread: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsUnread: () => ({ mutate: vi.fn() }),
  useDeleteNotification: () => ({ mutate: vi.fn() }),
  useDeleteAllNotifications: () => ({ mutate: vi.fn() }),
}))

function Panel() {
  const [open, setOpen] = useState(true)
  const ref = useRef(null)
  useDismissOnOutside(ref, () => setOpen(false), open)
  return (
    <div>
      <button type="button">outside</button>
      <div ref={ref}>
        <button type="button">inside</button>
        {open ? <p>panel open</p> : <p>panel closed</p>}
      </div>
    </div>
  )
}

describe('useDismissOnOutside', () => {
  it('closes when clicking outside the element', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    expect(screen.getByText('panel open')).toBeTruthy()
    await user.click(screen.getByText('outside'))
    expect(screen.getByText('panel closed')).toBeTruthy()
  })

  it('stays open when clicking inside the element', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByText('inside'))
    expect(screen.getByText('panel open')).toBeTruthy()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Panel />)
    await user.keyboard('{Escape}')
    expect(screen.getByText('panel closed')).toBeTruthy()
  })
})

describe('NotificationBell', () => {
  it('closes the notifications panel when clicking outside', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button type="button">elsewhere</button>
        <NotificationBell />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: /Notifications/ }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy())

    await user.click(screen.getByText('elsewhere'))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull(),
    )
  })
})
