import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './test-utils'
import { InviteView } from '../src/modules/home/views/InviteView'
import type { Team, TeamInvite } from '../src/types/invite'

const {
  myTeamMock,
  myInvitesMock,
  inviteToTeamMock,
  acceptInviteMock,
  revokeInviteMock,
} = vi.hoisted(() => ({
  myTeamMock: vi.fn(),
  myInvitesMock: vi.fn(),
  inviteToTeamMock: vi.fn(),
  acceptInviteMock: vi.fn(),
  revokeInviteMock: vi.fn(),
}))

vi.mock('../src/modules/invite/hooks', () => ({
  useMyTeam: () => ({
    data: myTeamMock(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useMyInvites: () => ({ data: myInvitesMock(), isPending: false }),
  useInviteToTeam: () => ({ mutateAsync: inviteToTeamMock, isPending: false }),
  useAcceptInvite: () => ({ mutateAsync: acceptInviteMock, isPending: false }),
  useRevokeInvite: () => ({ mutateAsync: revokeInviteMock, isPending: false }),
}))

/**
 * The API stores the invite lifecycle as a lowercase string (`status: String!`
 * in the schema), which is what these fixtures carry, while `TeamInvite`'s
 * `status` field enumerates uppercase values — so only that field is widened.
 */
type TeamInviteFixture = Omit<TeamInvite, 'status'> & { status: string }
type TeamFixture = Omit<Team, 'invites'> & { invites: TeamInviteFixture[] }

const team: TeamFixture = {
  id: 't1',
  name: 'Personal Workspace',
  role: 'ADMIN',
  members: [
    {
      id: 'u1',
      phone: '+233537144161',
      firstName: 'Hayford',
      surname: 'Afriyie',
      role: 'ADMIN',
      createdAt: '2026-01-01T10:00:00Z',
    },
    {
      id: 'u2',
      phone: '+233541230000',
      firstName: 'Kojo',
      surname: 'Asante',
      role: 'MEMBER',
      createdAt: '2026-09-01T10:00:00Z',
    },
  ],
  invites: [
    {
      id: 'i1',
      phone: '+233549876543',
      role: 'GUEST',
      status: 'pending',
      teamName: 'Personal Workspace',
      invitedBy: { id: 'u1', firstName: 'Hayford', surname: 'Afriyie' },
      createdAt: '2026-09-05T10:00:00Z',
      expiresAt: '2026-09-12T10:00:00Z',
    },
  ],
}

const invites: TeamInviteFixture[] = [
  {
    id: 'i9',
    teamName: 'Mobile App',
    role: 'GUEST',
    status: 'pending',
    phone: '+233537144161',
    invitedBy: { id: 'u9', firstName: 'Ama', surname: 'Mensah' },
    createdAt: '2026-09-02T09:00:00Z',
    expiresAt: '2026-09-09T09:00:00Z',
  },
]

function renderInvite() {
  return renderWithProviders(<InviteView />)
}

describe('InviteView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    myTeamMock.mockReturnValue(team)
    myInvitesMock.mockReturnValue([])
    inviteToTeamMock.mockResolvedValue({
      data: {
        inviteToTeam: { success: true, message: 'invitation sent' },
      },
    })
    acceptInviteMock.mockResolvedValue({
      data: { acceptInvite: { success: true, message: 'you joined the workspace' } },
    })
    revokeInviteMock.mockResolvedValue({ data: { revokeInvite: true } })
  })

  it('renders team members with their roles', () => {
    renderInvite()
    expect(screen.getByText('Members (2)')).toBeInTheDocument()
    expect(screen.getByText('Hayford Afriyie')).toBeInTheDocument()
    expect(screen.getByText('+233537144161')).toBeInTheDocument()
    expect(screen.getByText('Kojo Asante')).toBeInTheDocument()

    const membersList = screen.getByText('Members (2)').closest('section')
    if (!membersList) {
      throw new Error('Members panel not found')
    }
    expect(within(membersList).getByText('Admin')).toBeInTheDocument()
    expect(within(membersList).getByText('Member')).toBeInTheDocument()
  })

  it('shows pending invites and revokes one', async () => {
    const user = userEvent.setup()
    renderInvite()
    expect(screen.getByText('Pending invites')).toBeInTheDocument()
    expect(screen.getByText('+233549876543')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revoke invite for +233549876543' }))
    await waitFor(() => expect(revokeInviteMock).toHaveBeenCalledWith('i1'))
    expect(await screen.findByText('Invitation revoked.')).toBeInTheDocument()
  })

  it('resends an invite from the pending list', async () => {
    const user = userEvent.setup()
    renderInvite()

    await user.click(screen.getByRole('button', { name: 'Resend invite to +233549876543' }))
    await waitFor(() =>
      expect(inviteToTeamMock).toHaveBeenCalledWith({
        phone: '+233549876543',
        role: 'GUEST',
      }),
    )
    expect(await screen.findByText('Invitation resent.')).toBeInTheDocument()
  })

  it('sends an invite with the selected role', async () => {
    const user = userEvent.setup()
    renderInvite()

    await user.type(screen.getByRole('textbox', { name: 'Phone number' }), '0537144161')
    await user.click(screen.getByRole('combobox', { name: 'Member role' }))
    await user.click(await screen.findByRole('option', { name: 'Guest' }))
    await user.click(screen.getByRole('button', { name: 'Send invite' }))

    await waitFor(() =>
      expect(inviteToTeamMock).toHaveBeenCalledWith({ phone: '0537144161', role: 'GUEST' }),
    )
    expect(await screen.findByText('invitation sent')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toHaveValue('')
  })

  it('shows an error toast when the invite fails', async () => {
    inviteToTeamMock.mockResolvedValue({
      data: {
        inviteToTeam: { success: false, message: 'this person has already been invited' },
      },
    })
    const user = userEvent.setup()
    renderInvite()

    await user.type(screen.getByRole('textbox', { name: 'Phone number' }), '+233541230000')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))

    expect(
      await screen.findByText('this person has already been invited'),
    ).toBeInTheDocument()
  })

  it('validates an empty phone number', async () => {
    const { container } = renderInvite()
    const form = container.querySelector('form')
    if (!form) {
      throw new Error('Invite form not found')
    }
    fireEvent.submit(form)
    expect(await screen.findByText('Enter a phone number to invite.')).toBeInTheDocument()
    expect(inviteToTeamMock).not.toHaveBeenCalled()
  })

  it('shows invitations for you and accepts one', async () => {
    myInvitesMock.mockReturnValue(invites)
    const user = userEvent.setup()
    renderInvite()

    expect(screen.getByText('Invitations for you')).toBeInTheDocument()
    expect(screen.getByText('Mobile App')).toBeInTheDocument()
    expect(screen.getByText(/Invited by Ama Mensah/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(acceptInviteMock).toHaveBeenCalledWith('i9'))
    expect(await screen.findByText('you joined the workspace')).toBeInTheDocument()
  })
})
