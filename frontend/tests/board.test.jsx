import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoardView from '../src/modules/home/views/BoardView'
import * as taskHooks from '../src/modules/tasks/hooks'
import { renderWithProviders } from './test-utils'

vi.mock('../src/modules/invite/hooks', () => ({
  useMyTeam: () => ({
    data: {
      id: 'team-1',
      name: 'Personal',
      role: 'ADMIN',
      members: [
        { id: 'u-1', phone: '+233500000001', firstName: 'Ama', surname: 'Osei', role: 'ADMIN' },
      ],
    },
  }),
}))

vi.mock('../src/modules/tasks/hooks', () => {
  const statusMutate = vi.fn()
  const updateMutate = vi.fn()
  const createMutate = vi.fn()
  return {
    TASKS_KEY: ['teamTasks'],
    toApiStatus: (s) => String(s || 'TODO').toUpperCase(),
    useTeamTasks: () => ({
      data: [
        {
          id: 't-1',
          teamId: 'team-1',
          title: 'Ship release notes',
          description: 'Draft the notes for v2.',
          status: 'TODO',
          priority: 'HIGH',
          startDate: '2026-09-15T00:00:00Z',
          endDate: '2026-09-20T00:00:00Z',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z',
          createdBy: { id: 'u-1', phone: '+233500000001', firstName: 'Ama', surname: 'Osei' },
          assignee: null,
        },
        {
          id: 't-2',
          teamId: 'team-1',
          title: 'Finish dashboard',
          description: '',
          status: 'DONE',
          priority: 'MEDIUM',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z',
          createdBy: { id: 'u-1', phone: '+233500000001', firstName: 'Ama', surname: 'Osei' },
          assignee: { id: 'u-1', phone: '+233500000001', firstName: 'Ama', surname: 'Osei' },
        },
      ],
      isLoading: false,
    }),
    useSetTaskStatus: () => ({ mutate: statusMutate, isPending: false }),
    useAssignTask: () => ({ mutate: vi.fn(), isPending: false }),
    useCreateTask: () => ({ mutate: createMutate, isPending: false }),
    useUpdateTask: () => ({ mutate: updateMutate, isPending: false }),
    statusMutate,
    updateMutate,
    createMutate,
  }
})

describe('BoardView', () => {
  it('groups real tasks into columns and opens the add-task modal', async () => {
    renderWithProviders(<BoardView />)
    expect(screen.getByRole('heading', { name: 'To do' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'In progress' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    expect(screen.getByText('Ship release notes')).toBeInTheDocument()
    expect(screen.getByText('Finish dashboard')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Add task/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What needs doing?')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Priority' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Assignee' })).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('edits a task in a modal pre-filled with its details and syncs via the API', async () => {
    renderWithProviders(<BoardView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit task Ship release notes' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Task title')).toHaveValue('Ship release notes')
    expect(screen.getByLabelText('Description')).toHaveValue('Draft the notes for v2.')
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()

    const area = screen.getByLabelText('Description')
    await user.clear(area)
    await user.type(area, 'Add the changelog link')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(taskHooks.updateMutate).toHaveBeenCalledWith(
      {
        taskId: 't-1',
        input: expect.objectContaining({
          title: 'Ship release notes',
          description: 'Add the changelog link',
          status: 'TODO',
        }),
      },
      expect.any(Object),
    )
  })

  it('calls setTaskStatus when a card is moved via its status control', async () => {
    renderWithProviders(<BoardView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Change status of Ship release notes' }))
    await user.click(await screen.findByRole('option', { name: 'Done' }))
    expect(taskHooks.statusMutate).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't-1', status: 'DONE' }),
      expect.any(Object),
    )
  })

  it('shows the planned window on a card', () => {
    renderWithProviders(<BoardView />)
    expect(screen.getByText('15 Sep → 20 Sep')).toBeInTheDocument()
  })

  it('sends start and end dates when creating a task', async () => {
    taskHooks.createMutate.mockClear()
    renderWithProviders(<BoardView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Add task/ }))
    await user.type(screen.getByPlaceholderText('What needs doing?'), 'Plan the sprint')
    await user.type(screen.getByLabelText('Start date'), '2026-10-01')
    await user.type(screen.getByLabelText('End date'), '2026-10-15')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(taskHooks.createMutate).toHaveBeenCalledWith(
      {
        input: expect.objectContaining({
          title: 'Plan the sprint',
          startDate: '2026-10-01T00:00:00.000Z',
          endDate: '2026-10-15T00:00:00.000Z',
        }),
      },
      expect.any(Object),
    )
  })

  it('blocks a task whose end date is before its start date', async () => {
    taskHooks.createMutate.mockClear()
    renderWithProviders(<BoardView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Add task/ }))
    await user.type(screen.getByPlaceholderText('What needs doing?'), 'Backwards window')
    await user.type(screen.getByLabelText('Start date'), '2026-10-20')
    await user.type(screen.getByLabelText('End date'), '2026-10-01')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The end date cannot be before the start date.',
    )
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    expect(taskHooks.createMutate).not.toHaveBeenCalled()
  })

  it('pre-fills the dates when editing and clears one when blanked', async () => {
    taskHooks.updateMutate.mockClear()
    renderWithProviders(<BoardView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit task Ship release notes' }))
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-09-15')
    expect(screen.getByLabelText('End date')).toHaveValue('2026-09-20')

    await user.clear(screen.getByLabelText('Start date'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(taskHooks.updateMutate).toHaveBeenCalledWith(
      {
        taskId: 't-1',
        input: expect.objectContaining({
          startDate: null,
          clearStartDate: true,
          endDate: '2026-09-20T00:00:00.000Z',
        }),
      },
      expect.any(Object),
    )
  })
})
