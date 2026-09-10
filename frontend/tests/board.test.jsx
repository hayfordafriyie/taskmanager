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
  // Opens a Radix date picker and walks forward until the target day is shown,
  // then clicks it — mirrors how a user picks a date.
  async function pickDate(user, triggerLabel, dayLabel) {
    await user.click(screen.getByRole('button', { name: triggerLabel }))
    for (let i = 0; i < 24; i += 1) {
      const days = screen.queryAllByRole('button', { name: dayLabel })
      if (days.length > 0) {
        await user.click(days[0])
        return
      }
      await user.click(screen.getByRole('button', { name: 'Next month' }))
    }
    throw new Error(`date picker never showed ${dayLabel}`)
  }

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
    await pickDate(user, 'Start date', '1 Oct 2026')
    await pickDate(user, 'End date', '15 Oct 2026')
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

  it('disables end dates that fall before the chosen start date', async () => {
    renderWithProviders(<BoardView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Add task/ }))
    await pickDate(user, 'Start date', '15 Sep 2026')

    await user.click(screen.getByRole('button', { name: 'End date' }))
    // Earlier days in the same month must be unpickable, later ones selectable.
    expect(screen.getByRole('button', { name: '14 Sep 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '1 Sep 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '15 Sep 2026' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '20 Sep 2026' })).toBeEnabled()
  })

  it('disables start dates that fall after the chosen end date', async () => {
    renderWithProviders(<BoardView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Add task/ }))
    await pickDate(user, 'End date', '15 Sep 2026')

    await user.click(screen.getByRole('button', { name: 'Start date' }))
    expect(screen.getByRole('button', { name: '20 Sep 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '15 Sep 2026' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '1 Sep 2026' })).toBeEnabled()
  })

  it('pre-fills the dates when editing and clears one when blanked', async () => {
    taskHooks.updateMutate.mockClear()
    renderWithProviders(<BoardView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit task Ship release notes' }))
    expect(screen.getByRole('button', { name: 'Start date' })).toHaveTextContent('15 Sep 2026')
    expect(screen.getByRole('button', { name: 'End date' })).toHaveTextContent('20 Sep 2026')

    await user.click(screen.getByRole('button', { name: 'Start date' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
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
