import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimeView from '../src/modules/home/views/TimeView'
import * as timeHooks from '../src/modules/time/hooks'
import { renderWithProviders } from './test-utils'

const monday = (() => {
  const now = new Date()
  const day = (now.getDay() + 6) % 7
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
})()
const mondayIso = monday.toISOString()

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', firstName: 'Ama', surname: 'Osei' } }),
}))

vi.mock('../src/modules/tasks/hooks', () => ({
  useTeamTasks: () => ({
    data: [{ id: 't-1', title: 'Ship release notes' }],
  }),
}))

vi.mock('../src/modules/time/hooks', () => {
  const logSpy = vi.fn()
  const deleteSpy = vi.fn()
  return {
    formatHours: (minutes) => `${((Number(minutes) || 0) / 60).toFixed(1)}h`,
    toApiTime: (d) => (typeof d === 'string' ? `${d}T00:00:00.000Z` : d.toISOString()),
    useTimeEntries: () => ({
      isLoading: false,
      data: [
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
      ],
    }),
    useTimeSummary: () => ({
      data: { totalMinutes: 180, entryCount: 1, activeDays: 1, topLabel: 'Ship release notes', topMinutes: 180 },
    }),
    useLogTime: () => ({ mutate: logSpy, isPending: false }),
    useDeleteTimeEntry: () => ({ mutate: deleteSpy, isPending: false }),
    logSpy,
    deleteSpy,
  }
})

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
