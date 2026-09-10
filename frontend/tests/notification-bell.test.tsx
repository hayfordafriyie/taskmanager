import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationBell from '../src/components/NotificationBell'
import * as notifHooksModule from '../src/modules/notifications/hooks'
import type { AppNotification } from '../src/types/notifications'
import { renderWithProviders } from './test-utils'

const notifications: AppNotification[] = [
  {
    id: 'n-1',
    kind: 'task_assigned',
    title: 'New invite',
    body: 'Kojo invited you to a task.',
    taskId: null,
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n-2',
    kind: 'task_due_soon',
    title: 'Task due',
    body: 'Finish report by 5pm today.',
    taskId: null,
    read: true,
    createdAt: new Date().toISOString(),
  },
]

vi.mock('../src/modules/notifications/hooks', () => {
  const markReadSpy = vi.fn()
  const markUnreadSpy = vi.fn()
  const markAllReadSpy = vi.fn()
  const markAllUnreadSpy = vi.fn()
  const deleteSpy = vi.fn()
  const deleteAllSpy = vi.fn()
  return {
    useNotifications: () => ({ data: notifications }),
    useUnreadNotificationCount: () => ({ data: 1 }),
    useMarkNotificationRead: () => ({ mutate: markReadSpy, isPending: false }),
    useMarkNotificationUnread: () => ({ mutate: markUnreadSpy, isPending: false }),
    useMarkAllNotificationsRead: () => ({ mutate: markAllReadSpy, isPending: false }),
    useMarkAllNotificationsUnread: () => ({ mutate: markAllUnreadSpy, isPending: false }),
    useDeleteNotification: () => ({ mutate: deleteSpy, isPending: false }),
    useDeleteAllNotifications: () => ({ mutate: deleteAllSpy, isPending: false }),
    markReadSpy,
    markUnreadSpy,
    markAllReadSpy,
    markAllUnreadSpy,
    deleteSpy,
    deleteAllSpy,
  }
})

/**
 * `vi.mock` above swaps the entire notifications-hooks module out, so the spies
 * its factory creates are not part of the real module's exports. Intersecting
 * the namespace type with them keeps every `notifHooks.*Spy` assertion below
 * unchanged.
 */
type NotificationsHooksMock = typeof notifHooksModule & {
  markReadSpy: Mock
  markUnreadSpy: Mock
  markAllReadSpy: Mock
  markAllUnreadSpy: Mock
  deleteSpy: Mock
  deleteAllSpy: Mock
}

const notifHooks = notifHooksModule as unknown as NotificationsHooksMock

describe('NotificationBell', () => {
  it('shows the unread count and opens the notification list', async () => {
    renderWithProviders(<NotificationBell />)
    const bell = screen.getByRole('button', { name: 'Notifications (1 unread)' })
    expect(bell).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('1')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(bell)
    expect(bell).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('New invite')).toBeInTheDocument()
    expect(screen.getByText('Task due')).toBeInTheDocument()
  })

  it('marks one as read, all as read, and deletes all', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: 'Notifications (1 unread)' }))

    await user.click(screen.getByRole('button', { name: 'Mark New invite as read' }))
    expect(notifHooks.markReadSpy).toHaveBeenCalledWith({ id: 'n-1' })

    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(notifHooks.markAllReadSpy).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete all notifications' }))
    expect(notifHooks.deleteAllSpy).toHaveBeenCalled()
  })
})
