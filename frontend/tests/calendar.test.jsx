import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarView from '../src/modules/home/views/CalendarView'
import { renderWithProviders } from './test-utils'

const now = new Date()
const dueDate = new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0).toISOString()

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', firstName: 'Ama' } }),
}))

vi.mock('../src/modules/tasks/hooks', () => ({
  toApiStatus: (s) => String(s || 'TODO').toUpperCase(),
  useTeamTasks: () => ({
    isLoading: false,
    data: [
      {
        id: 't-assigned',
        title: 'Assigned work',
        status: 'IN_PROGRESS',
        dueAt: dueDate,
        assignee: { id: 'u-1' },
        createdBy: { id: 'u-2' },
      },
      {
        id: 't-created',
        title: 'Created work',
        status: 'DONE',
        dueAt: dueDate,
        assignee: { id: 'u-2' },
        createdBy: { id: 'u-1' },
      },
    ],
  }),
}))

describe('CalendarView', () => {
  it('places tasks on their due date and reports the month totals', () => {
    renderWithProviders(<CalendarView />)
    expect(screen.getByText('Assigned work')).toBeInTheDocument()
    expect(screen.getByText('Created work')).toBeInTheDocument()
    expect(screen.getByText(/2 due · 1 completed/)).toBeInTheDocument()
  })

  it('filters to tasks assigned to me', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CalendarView />)
    await user.click(screen.getByRole('button', { name: 'Assigned to me' }))
    expect(screen.getByText('Assigned work')).toBeInTheDocument()
    expect(screen.queryByText('Created work')).not.toBeInTheDocument()
  })

  it('filters to tasks I created', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CalendarView />)
    await user.click(screen.getByRole('button', { name: 'Created by me' }))
    expect(screen.getByText('Created work')).toBeInTheDocument()
    expect(screen.queryByText('Assigned work')).not.toBeInTheDocument()
  })
})
