import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkspaceSwitcher from '../src/components/WorkspaceSwitcher'
import { renderWithProviders } from './test-utils'

const switchMutate = vi.fn()
const teamsState = { data: [] }

vi.mock('../src/modules/invite/hooks', () => ({
  TEAM_KEY: ['myTeam'],
  TEAMS_KEY: ['myTeams'],
  INVITES_KEY: ['myInvites'],
  useMyTeam: () => ({ data: null }),
  useMyInvites: () => ({ data: [] }),
  useMyTeams: () => ({ data: teamsState.data, isPending: false }),
  useSwitchTeam: () => ({ mutateAsync: switchMutate, isPending: false }),
}))

vi.mock('../src/components/Toast', () => ({
  // The module also has a default export (the provider) — tests need a stand-in.
  default: ({ children }) => children ?? null,
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

const OWN = { id: 'team-own', name: 'Personal Workspace', role: 'ADMIN', isOwner: true, isActive: false, memberCount: 1 }
const JOINED = { id: 'team-joined', name: 'Akosua Trading', role: 'MEMBER', isOwner: false, isActive: true, memberCount: 3 }

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    switchMutate.mockReset()
    switchMutate.mockResolvedValue({ data: { switchTeam: { success: true, message: 'Now working in Personal Workspace' } } })
  })

  it('renders nothing when the user has a single workspace', () => {
    teamsState.data = [{ ...OWN, isActive: true }]
    renderWithProviders(<WorkspaceSwitcher />)
    expect(screen.queryByRole('button', { name: /Workspace:/ })).not.toBeInTheDocument()
  })

  it('shows the active workspace and its role', () => {
    teamsState.data = [JOINED, OWN]
    renderWithProviders(<WorkspaceSwitcher />)
    const trigger = screen.getByRole('button', { name: /Workspace: Akosua Trading/ })
    expect(trigger).toHaveTextContent('Akosua Trading')
    expect(trigger).toHaveTextContent(/member/i)
  })

  it('lists the owned workspace separately from joined teams', async () => {
    teamsState.data = [JOINED, OWN]
    renderWithProviders(<WorkspaceSwitcher />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Workspace:/ }))

    const own = await screen.findByRole('button', { name: 'Switch to Personal Workspace' })
    expect(own).toHaveTextContent('My workspace')
    const joined = screen.getByRole('button', { name: 'Switch to Akosua Trading' })
    expect(joined).toHaveTextContent('MEMBER')
    expect(joined).toHaveTextContent('3 members')
  })

  it('switches to the chosen workspace', async () => {
    teamsState.data = [JOINED, OWN]
    renderWithProviders(<WorkspaceSwitcher />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Workspace:/ }))
    await user.click(await screen.findByRole('button', { name: 'Switch to Personal Workspace' }))

    await waitFor(() => expect(switchMutate).toHaveBeenCalledTimes(1))
    expect(switchMutate).toHaveBeenCalledWith('team-own')
  })

  it('does not call the API when picking the active workspace', async () => {
    teamsState.data = [JOINED, OWN]
    renderWithProviders(<WorkspaceSwitcher />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Workspace:/ }))
    await user.click(await screen.findByRole('button', { name: 'Switch to Akosua Trading' }))

    expect(switchMutate).not.toHaveBeenCalled()
  })
})
