import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalsView from '../src/modules/home/views/GoalsView'
import * as goalHooks from '../src/modules/goals/hooks'
import { renderWithProviders } from './test-utils'

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', firstName: 'Ama', surname: 'Osei' } }),
}))

vi.mock('../src/modules/invite/hooks', () => ({
  useMyTeam: () => ({
    data: {
      members: [
        { id: 'u-1', firstName: 'Ama', surname: 'Osei', phone: '+233500000001' },
        { id: 'u-2', firstName: 'Kojo', surname: 'Afriyie', phone: '+233500000002' },
      ],
    },
  }),
}))

vi.mock('../src/modules/goals/hooks', () => {
  const createSpy = vi.fn()
  const statusSpy = vi.fn()
  const krProgressSpy = vi.fn()
  const addKrSpy = vi.fn()
  const deleteSpy = vi.fn()
  return {
    GOAL_STATUS_LABEL: { ON_TRACK: 'On track', AT_RISK: 'At risk', BEHIND: 'Behind', DONE: 'Done' },
    GOAL_STATUS_OPTIONS: [
      { value: 'ON_TRACK', label: 'On track' },
      { value: 'AT_RISK', label: 'At risk' },
      { value: 'BEHIND', label: 'Behind' },
      { value: 'DONE', label: 'Done' },
    ],
    useTeamGoals: () => ({
      isLoading: false,
      data: [
        {
          id: 'g-1',
          teamId: 'team-1',
          title: 'Ship v2',
          description: 'Get v2 out',
          status: 'ON_TRACK',
          dueAt: null,
          progress: 70,
          owner: { id: 'u-1', firstName: 'Ama', surname: 'Osei', phone: '+233500000001' },
          keyResults: [
            { id: 'kr-1', title: 'Release mobile app', progress: 80, createdAt: '2026-09-01T00:00:00Z' },
          ],
        },
      ],
    }),
    useCreateGoal: () => ({ mutate: createSpy, isPending: false }),
    useUpdateGoalStatus: () => ({ mutate: statusSpy, isPending: false }),
    useCreateKeyResult: () => ({ mutate: addKrSpy, isPending: false }),
    useSetKeyResultProgress: () => ({ mutate: krProgressSpy, isPending: false }),
    useDeleteGoal: () => ({ mutate: deleteSpy, isPending: false }),
    createSpy,
    statusSpy,
    krProgressSpy,
    addKrSpy,
    deleteSpy,
  }
})

describe('GoalsView', () => {
  it('renders API goals with progress, owner and key results', () => {
    renderWithProviders(<GoalsView />)
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeInTheDocument()
    expect(screen.getByText('Ship v2')).toBeInTheDocument()
    expect(screen.getByText('Release mobile app')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('Ama Osei')).toBeInTheDocument()
  })

  it('creates a goal from the New goal modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GoalsView />)
    await user.click(screen.getByRole('button', { name: 'New goal' }))
    await user.type(screen.getByLabelText('Goal title'), 'Grow usage')
    await user.click(screen.getByRole('button', { name: 'Create goal' }))
    expect(goalHooks.createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ title: 'Grow usage', status: 'ON_TRACK' }),
      }),
      expect.any(Object),
    )
  })

  it('changes goal status and checks in on a key result', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GoalsView />)

    await user.click(screen.getByRole('combobox', { name: 'Status of Ship v2' }))
    await user.click(await screen.findByRole('option', { name: 'At risk' }))
    expect(goalHooks.statusSpy).toHaveBeenCalledWith(
      { goalId: 'g-1', status: 'AT_RISK' },
      expect.any(Object),
    )

    const slider = screen.getByLabelText('Progress of Release mobile app')
    await user.clear(slider)
    await user.type(slider, '95')
    expect(goalHooks.krProgressSpy).toHaveBeenCalledWith(
      { keyResultId: 'kr-1', progress: 95 },
      expect.any(Object),
    )
  })
})
