import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InboxView from '../src/modules/home/views/InboxView'
import * as chatHooksModule from '../src/modules/chat/hooks'
import type { ChatConversation, ChatMessage, ChatPerson } from '../src/types/chat'
import { renderWithProviders } from './test-utils'

// Built inside `vi.hoisted` so the hoisted `vi.mock` factories below can read it
// safely — a plain module-level const would still be in its temporal dead zone
// the first time the mocked module is imported.
const { now } = vi.hoisted(() => ({ now: new Date().toISOString() }))

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', firstName: 'Ama', surname: 'Osei' } }),
}))

vi.mock('../src/modules/invite/hooks', () => ({
  useMyTeam: () => ({
    data: {
      id: 'team-1',
      role: 'ADMIN',
      members: [
        { id: 'u-1', firstName: 'Ama', surname: 'Osei', phone: '+233500000001', role: 'ADMIN' },
        { id: 'u-2', firstName: 'Kojo', surname: 'Afriyie', phone: '+233500000002', role: 'MEMBER' },
        { id: 'u-3', firstName: 'Yaw', surname: 'Mensah', phone: '+233500000003', role: 'MEMBER' },
      ],
    },
  }),
}))

vi.mock('../src/modules/chat/hooks', () => {
  const sendSpy = vi.fn()
  const markReadSpy = vi.fn()
  const startSpy = vi.fn()

  // The inbox's trimmed `lastMessage` selection sends the sender id only, so
  // the fixture type narrows `sender` down to that one field.
  type LastMessageFixture = Omit<ChatMessage, 'sender'> & {
    sender: Pick<ChatPerson, 'id'>
  }
  type ConversationFixture = Omit<ChatConversation, 'lastMessage'> & {
    lastMessage: LastMessageFixture
  }

  const conversations: ConversationFixture[] = [
    {
      id: 'c-1',
      teamId: 'team-1',
      kind: 'direct',
      unreadCount: 2,
      lastMessageAt: now,
      peer: { id: 'u-2', firstName: 'Kojo', surname: 'Afriyie', phone: '+233500000002' },
      lastMessage: { id: 'm-0', body: 'See you tomorrow', createdAt: now, sender: { id: 'u-2' } },
    },
  ]
  const messages: ChatMessage[] = [
    {
      id: 'm-1',
      conversationId: 'c-1',
      body: 'Hello there',
      createdAt: now,
      sender: { id: 'u-2', firstName: 'Kojo', surname: 'Afriyie' },
    },
  ]

  return {
    useConversations: () => ({
      isLoading: false,
      data: conversations,
    }),
    useConversationMessages: () => ({
      isLoading: false,
      data: messages,
    }),
    useStartConversation: () => ({ mutate: startSpy, isPending: false }),
    useSendMessage: () => ({ mutate: sendSpy, isPending: false }),
    useMarkConversationRead: () => ({ mutate: markReadSpy, isPending: false }),
    sendSpy,
    markReadSpy,
    startSpy,
  }
})

/**
 * `vi.mock` above swaps the entire chat-hooks module out, so the spies its
 * factory creates are not part of the real module's exports. Intersecting the
 * namespace type with them keeps every `chatHooks.*Spy` assertion below
 * unchanged.
 */
type ChatHooksMock = typeof chatHooksModule & {
  sendSpy: Mock
  markReadSpy: Mock
  startSpy: Mock
}

const chatHooks = chatHooksModule as unknown as ChatHooksMock

describe('InboxView', () => {
  it('lists conversations with the peer and unread badge', () => {
    renderWithProviders(<InboxView />)
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument()
    expect(screen.getByText('Kojo Afriyie')).toBeInTheDocument()
    expect(screen.getByText('See you tomorrow')).toBeInTheDocument()
    expect(screen.getByLabelText('2 unread messages')).toBeInTheDocument()
  })

  it('opens a conversation and shows its messages, marking it read', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InboxView />)
    await user.click(screen.getByRole('button', { name: 'Continue chat with Kojo Afriyie' }))
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(chatHooks.markReadSpy).toHaveBeenCalledWith('c-1')
  })

  it('sends a message from the composer', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InboxView />)
    await user.click(screen.getByRole('button', { name: 'Continue chat with Kojo Afriyie' }))
    await user.type(screen.getByLabelText('Message'), 'Hi Kojo')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(chatHooks.sendSpy).toHaveBeenCalledWith('Hi Kojo', expect.any(Object))
  })

  it('opens the existing conversation instead of creating a new one', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InboxView />)
    await user.click(screen.getByRole('button', { name: 'Continue chat with Kojo Afriyie' }))
    expect(chatHooks.startSpy).not.toHaveBeenCalled()
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('creates a conversation for a teammate with no existing chat', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InboxView />)
    await user.click(screen.getByRole('button', { name: 'Start chat with Yaw Mensah' }))
    expect(chatHooks.startSpy).toHaveBeenCalledWith('u-3', expect.any(Object))
  })
})
