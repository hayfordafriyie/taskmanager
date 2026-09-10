import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocsView from '../src/modules/home/views/DocsView'
import * as docHooks from '../src/modules/docs/hooks'
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

vi.mock('../src/modules/docs/hooks', () => {
  const createSpy = vi.fn()
  const updateSpy = vi.fn()
  const deleteSpy = vi.fn()
  const setAccessSpy = vi.fn()
  const revokeSpy = vi.fn()
  return {
    VISIBILITY_OPTIONS: [
      { value: 'TEAM', label: 'Whole team' },
      { value: 'RESTRICTED', label: 'Restricted (invite only)' },
      { value: 'PRIVATE', label: 'Private (just me)' },
    ],
    VISIBILITY_LABEL: { TEAM: 'Team', RESTRICTED: 'Restricted', PRIVATE: 'Private' },
    VISIBILITY_TONE: { TEAM: 'tone-indigo', RESTRICTED: 'tone-amber', PRIVATE: 'tone-neutral' },
    useTeamDocs: () => ({
      isLoading: false,
      data: [
        {
          id: 'd-1',
          teamId: 'team-1',
          title: 'Roadmap',
          body: 'Plan',
          visibility: 'TEAM',
          canEdit: true,
          accessCount: 1,
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z',
          createdBy: { id: 'u-1', firstName: 'Ama', surname: 'Osei' },
        },
        {
          id: 'd-2',
          teamId: 'team-1',
          title: 'Secret plan',
          body: 'Top secret',
          visibility: 'RESTRICTED',
          canEdit: false,
          accessCount: 0,
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z',
          createdBy: { id: 'u-2', firstName: 'Kojo', surname: 'Afriyie' },
        },
      ],
    }),
    useDocAccessList: () => ({ data: [] }),
    useCreateDoc: () => ({ mutate: createSpy, isPending: false }),
    useUpdateDoc: () => ({ mutate: updateSpy, isPending: false }),
    useDeleteDoc: () => ({ mutate: deleteSpy, isPending: false }),
    useSetDocAccess: () => ({ mutate: setAccessSpy, isPending: false }),
    useRevokeDocAccess: () => ({ mutate: revokeSpy, isPending: false }),
    createSpy,
    updateSpy,
    deleteSpy,
    setAccessSpy,
    revokeSpy,
  }
})

describe('DocsView', () => {
  it('lists API docs grouped by visibility', () => {
    renderWithProviders(<DocsView />)
    expect(screen.getByRole('heading', { name: 'Docs' })).toBeInTheDocument()
    expect(screen.getByText('Shared with team')).toBeInTheDocument()
    expect(screen.getByText('Restricted')).toBeInTheDocument()
    expect(screen.getByText('Roadmap')).toBeInTheDocument()
    expect(screen.getByText('Secret plan')).toBeInTheDocument()
  })

  it('edits and saves a document', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DocsView />)
    await user.click(screen.getByRole('button', { name: 'Open document Roadmap' }))
    const body = screen.getByLabelText('Document body')
    expect(body).toHaveValue('Plan')
    await user.clear(body)
    await user.type(body, 'Plan v2')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(docHooks.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ docId: 'd-1', body: 'Plan v2', visibility: 'TEAM' }),
      expect.any(Object),
    )
  })

  it('grants per-member access from the Share modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DocsView />)
    await user.click(screen.getByRole('button', { name: 'Open document Roadmap' }))
    await user.click(screen.getByRole('button', { name: 'Share' }))
    await user.click(screen.getByRole('button', { name: 'Grant access for Kojo Afriyie' }))
    expect(docHooks.setAccessSpy).toHaveBeenCalledWith(
      { docId: 'd-1', userId: 'u-2', canEdit: false },
      expect.any(Object),
    )
  })

  it('shows read-only docs without an editor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DocsView />)
    await user.click(screen.getByRole('button', { name: 'Open document Secret plan' }))
    expect(screen.getByText('Top secret')).toBeInTheDocument()
    expect(screen.getByText('Read only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})
