import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSwitchTeam } from '../src/modules/invite/hooks'

const gqlMock = vi.fn()
vi.mock('../src/lib/api', () => ({ gql: (...args) => gqlMock(...args) }))

const OLD_TEAM = { id: 'team-old', name: 'Personal Workspace', role: 'MEMBER' }
const NEW_TEAM = { id: 'team-new', name: 'Personal Workspace', role: 'ADMIN' }

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['myTeam'], OLD_TEAM)
  client.setQueryData(['teamTasks'], [{ id: 't-1', title: 'old workspace task' }])
  client.setQueryData(['dashboard'], { upcomingTasks: [{ id: 't-1' }] })
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useSwitchTeam(), { wrapper })
  return { client, result }
}

describe('switching workspace', () => {
  beforeEach(() => gqlMock.mockReset())

  it('refreshes the active workspace immediately so nothing stale is rendered', async () => {
    gqlMock.mockResolvedValue({ data: { switchTeam: { success: true, message: 'ok', team: NEW_TEAM } } })
    const { client, result } = setup()

    await act(async () => {
      await result.current.mutateAsync({ teamId: 'team-new' })
    })

    // The handshake carries the new team at once — the shell re-renders into the
    // new workspace without waiting for a page refresh.
    await waitFor(() => expect(client.getQueryData(['myTeam']).id).toBe('team-new'))

    // …and every other team-scoped cache is dropped, so the board/tasks cannot
    // keep showing the previous workspace's data.
    expect(client.getQueryData(['teamTasks'])).toBeUndefined()
    expect(client.getQueryData(['dashboard'])).toBeUndefined()
  })

  it('leaves everything untouched when the switch is refused', async () => {
    gqlMock.mockResolvedValue({ data: { switchTeam: { success: false, message: 'not a member' } } })
    const { client, result } = setup()

    await act(async () => {
      await result.current.mutateAsync({ teamId: 'team-nope' })
    })

    expect(client.getQueryData(['myTeam']).id).toBe('team-old')
    expect(client.getQueryData(['teamTasks'])).toHaveLength(1)
  })
})
