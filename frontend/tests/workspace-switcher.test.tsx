import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import WorkspaceSwitcher from '../src/components/WorkspaceSwitcher'
import type { TeamSummary } from '../src/types/invite'
import { renderWithProviders } from './test-utils'

const switchMutate = vi.fn()
const teamsState: { data: TeamSummary[] } = { data: [] }

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
  default: ({ children }: { children?: ReactNode }) => children ?? null,
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

// Both workspaces share the generated name, exactly like production.
const OWN: TeamSummary = { id: 'team-own', name: 'Personal Workspace', role: 'ADMIN', isOwner: true, isActive: false, memberCount: 1, ownerName: 'Ama Osei' }
const JOINED: TeamSummary = { id: 'team-joined', name: 'Personal Workspace', role: 'MEMBER', isOwner: false, isActive: true, memberCount: 3, ownerName: 'Hayford Afriyie' }

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
    // A joined workspace is named after its owner, not the generic team name.
    const trigger = screen.getByRole('button', { name: /Workspace: Hayford Afriyie's workspace/ })
    expect(trigger).toHaveTextContent("Hayford Afriyie's workspace")
    expect(trigger).toHaveTextContent(/member/i)
  })

  it('lists the owned workspace separately from joined teams', async () => {
    teamsState.data = [JOINED, OWN]
    renderWithProviders(<WorkspaceSwitcher />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Workspace:/ }))

    const own = await screen.findByRole('button', { name: 'Switch to Personal Workspace' })
    expect(own).toHaveTextContent('My workspace')
    const joined = screen.getByRole('button', { name: "Switch to Hayford Afriyie's workspace" })
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
    await user.click(await screen.findByRole('button', { name: "Switch to Hayford Afriyie's workspace" }))

    expect(switchMutate).not.toHaveBeenCalled()
  })
})
