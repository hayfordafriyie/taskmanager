import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimeView from '../src/modules/home/views/TimeView'
import * as timeHooksModule from '../src/modules/time/hooks'
import type { Task } from '../src/types/tasks'
import type { TimeEntry, TimeSummary } from '../src/types/time'
import { renderWithProviders } from './test-utils'

// Built inside `vi.hoisted` so the hoisted `vi.mock` factories below can read it
// safely — a plain module-level const would still be in its temporal dead zone
// the first time the mocked module is imported.
const { mondayIso } = vi.hoisted(() => {
  const now = new Date()
  const day = (now.getDay() + 6) % 7
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
  return { mondayIso: monday.toISOString() }
})

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', firstName: 'Ama', surname: 'Osei' } }),
}))

vi.mock('../src/modules/tasks/hooks', () => {
  // `TimeView` only reads the id and title of the team tasks it lists.
  const tasks: Pick<Task, 'id' | 'title'>[] = [
    { id: 't-1', title: 'Ship release notes' },
  ]
  return {
    useTeamTasks: () => ({
      data: tasks,
    }),
  }
})

vi.mock('../src/modules/time/hooks', () => {
  const logSpy = vi.fn()
  const deleteSpy = vi.fn()

  const entries: TimeEntry[] = [
    {
      id: 'e-1',
      userId: 'u-1',
      taskId: 't-1',
      taskTitle: 'Ship release notes',
      label: 'Ship release notes',
      minutes: 180,
      spentOn: mondayIso,
      note: '',
      createdAt: mondayIso,
    },
  ]
  const summary: TimeSummary = {
    totalMinutes: 180,
    entryCount: 1,
    activeDays: 1,
    topLabel: 'Ship release notes',
    topMinutes: 180,
  }

  return {
    // Only ever called by the view with a minute count and a `string | Date`.
    formatHours: (minutes: number) => `${((Number(minutes) || 0) / 60).toFixed(1)}h`,
    toApiTime: (d: string | Date) =>
      typeof d === 'string' ? `${d}T00:00:00.000Z` : d.toISOString(),
    useTimeEntries: () => ({
      isLoading: false,
      data: entries,
    }),
    useTimeSummary: () => ({
      data: summary,
    }),
    useLogTime: () => ({ mutate: logSpy, isPending: false }),
    useDeleteTimeEntry: () => ({ mutate: deleteSpy, isPending: false }),
    logSpy,
    deleteSpy,
  }
})

/**
 * `vi.mock` above swaps the entire time-hooks module out, so the spies its
 * factory creates are not part of the real module's exports. Intersecting the
 * namespace type with them keeps every `timeHooks.*Spy` assertion below
 * unchanged.
 */
type TimeHooksMock = typeof timeHooksModule & {
  logSpy: Mock
  deleteSpy: Mock
}

const timeHooks = timeHooksModule as unknown as TimeHooksMock

describe('TimeView', () => {
  it('renders API summary cards and this week rows', () => {
    renderWithProviders(<TimeView />)
    expect(screen.getByRole('heading', { name: 'Time' })).toBeInTheDocument()
    expect(screen.getByText('Hours logged')).toBeInTheDocument()
    expect(screen.getAllByText('3.0h').length).toBeGreaterThan(0)
    expect(screen.getByText('Top project')).toBeInTheDocument()
    expect(screen.getAllByText('Ship release notes').length).toBeGreaterThan(0)
  })

  it('logs time from the modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TimeView />)
    await user.click(screen.getByRole('button', { name: 'Log time' }))
    await user.type(screen.getByLabelText('Hours'), '2')
    await user.click(screen.getByRole('button', { name: 'Save entry' }))
    expect(timeHooks.logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ minutes: 120 }),
      }),
      expect.any(Object),
    )
  })

  it('deletes an entry', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TimeView />)
    await user.click(
      screen.getByRole('button', { name: 'Delete time entry for Ship release notes' }),
    )
    expect(timeHooks.deleteSpy).toHaveBeenCalledWith({ entryId: 'e-1' }, expect.any(Object))
  })
})
