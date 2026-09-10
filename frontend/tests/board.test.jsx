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
  const describeMutate = vi.fn()
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
    useUpdateTaskDescription: () => ({ mutate: describeMutate, isPending: false }),
    statusMutate,
    describeMutate,
    createMutate,
  }
})

describe('BoardView', () => {
  it('groups real tasks into columns and opens the add-task composer', async () => {
    renderWithProviders(<BoardView />)
    expect(screen.getByRole('heading', { name: 'To do' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'In progress' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    expect(screen.getByText('Ship release notes')).toBeInTheDocument()
    expect(screen.getByText('Finish dashboard')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Add task/ }))
    expect(screen.getByPlaceholderText('What needs doing?')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Assignee' })).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('edits a task description and syncs it through the API', async () => {
    renderWithProviders(<BoardView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit description of Ship release notes' }))
    const area = screen.getByLabelText('Edit description of Ship release notes')
    await user.clear(area)
    await user.type(area, 'Add the changelog link')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(taskHooks.describeMutate).toHaveBeenCalledWith(
      { taskId: 't-1', description: 'Add the changelog link' },
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
})
