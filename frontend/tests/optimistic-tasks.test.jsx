import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { TASKS_KEY, useAssignTask, useSetTaskStatus } from '../src/modules/tasks/hooks'
import { TEAM_KEY } from '../src/modules/invite/hooks'

const gqlMock = vi.fn()
vi.mock('../src/lib/api', () => ({ gql: (...args) => gqlMock(...args) }))
vi.mock('../src/modules/invite/hooks', () => ({ TEAM_KEY: ['myTeam'], useMyTeam: () => ({ data: null }) }))

const seedTasks = () => [
  { id: 't-1', title: 'Ship release notes', status: 'TODO', assignee: null },
  { id: 't-2', title: 'Finish dashboard', status: 'DONE', assignee: { id: 'u-2' } },
]

function setup(hook) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(TASKS_KEY, seedTasks())
  client.setQueryData(TEAM_KEY, {
    id: 'team-1',
    members: [
      { id: 'u-1', phone: '+233500000001', firstName: 'Ama', surname: 'Osei' },
      { id: 'u-2', phone: '+233500000002', firstName: 'Kojo', surname: 'Mensah' },
    ],
  })
  const wrapper = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(hook, { wrapper })
  return { client, result }
}

const statusOf = (client, id) =>
  client.getQueryData(TASKS_KEY).find((t) => t.id === id)?.status

describe('optimistic task updates', () => {
  beforeEach(() => {
    gqlMock.mockReset()
  })

  it('moves the card to its new column before the API responds', async () => {
    let resolveRequest
    gqlMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    )
    const { client, result } = setup(() => useSetTaskStatus())

    act(() => {
      result.current.mutate({ taskId: 't-1', status: 'IN_PROGRESS' })
    })

    // Still pending on the server, but the card has already moved.
    await waitFor(() => expect(statusOf(client, 't-1')).toBe('IN_PROGRESS'))
    expect(result.current.isPending).toBe(true)

    act(() => {
      resolveRequest({ data: { setTaskStatus: { success: true } } })
    })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(statusOf(client, 't-1')).toBe('IN_PROGRESS')
  })

  it('puts the card back when the API fails', async () => {
    gqlMock.mockImplementation(() => Promise.reject(new Error('network down')))
    const { client, result } = setup(() => useSetTaskStatus())

    act(() => {
      result.current.mutate({ taskId: 't-1', status: 'DONE' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    // t-1 is back in To do and the other card never moved.
    expect(statusOf(client, 't-1')).toBe('TODO')
    expect(statusOf(client, 't-2')).toBe('DONE')
  })

  it('normalises a lowercase status before showing it', async () => {
    gqlMock.mockImplementation(() => new Promise(() => {}))
    const { client, result } = setup(() => useSetTaskStatus())

    act(() => {
      result.current.mutate({ taskId: 't-1', status: 'review' })
    })

    await waitFor(() => expect(statusOf(client, 't-1')).toBe('REVIEW'))
  })

  it('reassigns instantly and rolls the assignee back on failure', async () => {
    let rejectRequest
    gqlMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    const { client, result } = setup(() => useAssignTask())

    act(() => {
      result.current.mutate({ taskId: 't-1', assigneeId: 'u-2' })
    })

    // Optimistic: the avatar switches to the chosen member straight away.
    await waitFor(() =>
      expect(client.getQueryData(TASKS_KEY).find((t) => t.id === 't-1').assignee.id).toBe('u-2'),
    )

    act(() => {
      rejectRequest(new Error('boom'))
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryData(TASKS_KEY).find((t) => t.id === 't-1').assignee).toBeNull()
  })

  it('does not let a stale refetch overwrite the optimistic move', async () => {
    let resolveRequest
    gqlMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    )
    const { client, result } = setup(() => useSetTaskStatus())

    act(() => {
      result.current.mutate({ taskId: 't-1', status: 'REVIEW' })
    })
    await waitFor(() => expect(statusOf(client, 't-1')).toBe('REVIEW'))

    // A competing fetch that returns the pre-move list must be cancelled by
    // onMutate, so the card cannot jump back mid-request.
    await act(async () => {
      client.setQueryData(TASKS_KEY, seedTasks())
      await client.cancelQueries({ queryKey: TASKS_KEY })
    })
    act(() => {
      result.current.mutate({ taskId: 't-1', status: 'DONE' })
    })
    await waitFor(() => expect(statusOf(client, 't-1')).toBe('DONE'))

    act(() => {
      resolveRequest({ data: { setTaskStatus: { success: true } } })
    })
    await waitFor(() => expect(result.current.isPending).toBe(false))
  })
})
