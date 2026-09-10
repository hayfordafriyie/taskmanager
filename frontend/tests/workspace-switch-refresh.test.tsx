import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useSwitchTeam } from '../src/modules/invite/hooks'
import type { ApiResponse } from '../src/types/api'
import type { SwitchTeamData, SwitchTeamResult, Team } from '../src/types/invite'

/** The workspace fields `switchTeam` selects (`team { id name role }`). */
type SwitchTeamTeam = Pick<Team, 'id' | 'name' | 'role'>

/** The `switchTeam` payload these fixtures feed the mocked `gql`. */
type SwitchTeamFixture = Omit<SwitchTeamResult, 'team'> & {
  team?: SwitchTeamTeam | null
}
type SwitchTeamFixtureData = Omit<SwitchTeamData, 'switchTeam'> & {
  switchTeam: SwitchTeamFixture
}

const gqlMock = vi.fn<
  (...args: unknown[]) => Promise<ApiResponse<SwitchTeamFixtureData>>
>()
vi.mock('../src/lib/api', () => ({ gql: (...args: unknown[]) => gqlMock(...args) }))

const OLD_TEAM: SwitchTeamTeam = { id: 'team-old', name: 'Personal Workspace', role: 'MEMBER' }
const NEW_TEAM: SwitchTeamTeam = { id: 'team-new', name: 'Personal Workspace', role: 'ADMIN' }

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['myTeam'], OLD_TEAM)
  client.setQueryData(['teamTasks'], [{ id: 't-1', title: 'old workspace task' }])
  client.setQueryData(['dashboard'], { upcomingTasks: [{ id: 't-1' }] })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useSwitchTeam(), { wrapper })
  return { client, result }
}

describe('switching workspace', () => {
  beforeEach(() => gqlMock.mockReset())

  it('refreshes the active workspace immediately so nothing stale is rendered', async () => {
    gqlMock.mockResolvedValue({ data: { switchTeam: { success: true, message: 'ok', team: NEW_TEAM } } })
    const { client, result } = setup()

    await act(async () => {
      // `useSwitchTeam` types its variables as the bare team id (the switcher
      // calls `mutateAsync(team.id)`); this test hands the mutation the GraphQL
      // variable object instead, which the mocked `gql` ignores — the cast only
      // satisfies that signature.
      await result.current.mutateAsync({ teamId: 'team-new' } as unknown as string)
    })

    // The handshake carries the new team at once — the shell re-renders into the
    // new workspace without waiting for a page refresh.
    await waitFor(() => expect(client.getQueryData<SwitchTeamTeam>(['myTeam'])?.id).toBe('team-new'))

    // …and every other team-scoped cache is dropped, so the board/tasks cannot
    // keep showing the previous workspace's data.
    expect(client.getQueryData(['teamTasks'])).toBeUndefined()
    expect(client.getQueryData(['dashboard'])).toBeUndefined()
  })

  it('leaves everything untouched when the switch is refused', async () => {
    gqlMock.mockResolvedValue({ data: { switchTeam: { success: false, message: 'not a member' } } })
    const { client, result } = setup()

    await act(async () => {
      // Same cast as above: the mutation is handed the GraphQL variable object.
      await result.current.mutateAsync({ teamId: 'team-nope' } as unknown as string)
    })

    expect(client.getQueryData<SwitchTeamTeam>(['myTeam'])?.id).toBe('team-old')
    expect(client.getQueryData(['teamTasks'])).toHaveLength(1)
  })
})
