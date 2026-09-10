import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarView from '../src/modules/home/views/CalendarView'
import type { User } from '../src/types/common'
import type { Task } from '../src/types/tasks'
import { renderWithProviders } from './test-utils'

// Built inside `vi.hoisted` so the hoisted `vi.mock` factories below can read it
// safely — a plain module-level const would still be in its temporal dead zone
// the first time the mocked module is imported.
const { dueDate } = vi.hoisted(() => {
  const now = new Date()
  return {
    dueDate: new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0).toISOString(),
  }
})

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', firstName: 'Ama' } }),
}))

// The fields `CalendarView` reads off a cached task: the fixture is a partial of
// `Task` because only the id of the assignee/creator is used for filtering.
type CalendarTask = Pick<Task, 'id' | 'title' | 'status' | 'dueAt'> & {
  assignee: Pick<User, 'id'> | null
  createdBy: Pick<User, 'id'>
}

vi.mock('../src/modules/tasks/hooks', () => {
  const tasks: CalendarTask[] = [
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
  ]
  return {
    toApiStatus: (status?: string | null) => String(status || 'TODO').toUpperCase(),
    useTeamTasks: () => ({
      isLoading: false,
      data: tasks,
    }),
  }
})

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
