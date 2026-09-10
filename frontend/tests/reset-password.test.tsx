import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithProviders } from './test-utils'
import ResetPassword from '../src/modules/reset-password'
import Login from '../src/modules/login'
import type { ApiResponse } from '../src/types/api'
import type {
  RequestPasswordResetData,
  ResetPasswordData,
} from '../src/types/auth'

/** Every response shape this suite feeds to the mocked `gql`. */
type ResetGqlData = RequestPasswordResetData | ResetPasswordData

const { gqlMock } = vi.hoisted(() => ({
  gqlMock: vi.fn<(...args: unknown[]) => Promise<ApiResponse<ResetGqlData>>>(),
}))

vi.mock('../src/lib/api', () => ({
  gql: gqlMock,
  clearTokens: vi.fn(),
  setTokens: vi.fn(),
}))

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
    initializing: false,
  }),
}))

function renderReset() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/reset-password']}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResetPassword', () => {
  beforeEach(() => {
    gqlMock.mockReset()
  })

  async function fillPhone(user: UserEvent) {
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Send reset code' }))
    await screen.findByPlaceholderText('Verification code')
  }

  async function fillResetForm(user: UserEvent, confirm = 'secret') {
    await user.type(screen.getByPlaceholderText('Verification code'), '123456')
    await user.type(screen.getByPlaceholderText('New password'), 'secret')
    await user.type(
      screen.getByPlaceholderText('Confirm new password'),
      confirm,
    )
  }

  it('renders heading and send-code controls', () => {
    renderReset()
    expect(
      screen.getByRole('heading', { name: 'Reset Password' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send reset code' }),
    ).toBeInTheDocument()
  })

  it('disables the submit button until a phone is provided', async () => {
    const user = userEvent.setup()
    renderReset()
    const submit = screen.getByRole('button', { name: 'Send reset code' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByRole('textbox'), '0537144161')
    expect(submit).toBeEnabled()
  })

  it('shows a validation toast when the empty form is submitted', async () => {
    const { container } = renderReset()
    const form = container.querySelector('form')
    if (!form) {
      throw new Error('reset-password form was not rendered')
    }
    fireEvent.submit(form)
    expect(
      await screen.findByText('Enter your phone number first.'),
    ).toBeInTheDocument()
    expect(gqlMock).not.toHaveBeenCalled()
  })

  it('moves to the code stage on successful request', async () => {
    gqlMock.mockResolvedValue({
      data: {
        requestPasswordReset: {
          success: true,
          message: 'A reset code was sent to your phone.',
        },
      },
    })
    const user = userEvent.setup()
    renderReset()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Send reset code' }))
    expect(
      await screen.findByText('A reset code was sent to your phone.'),
    ).toBeInTheDocument()
    const codeInput = screen.getByPlaceholderText('Verification code')
    expect(codeInput).toBeInTheDocument()
    expect(screen.getByPlaceholderText('53 714 4161')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Reset password' }),
    ).toBeInTheDocument()
  })

  it('shows an error toast when the request fails', async () => {
    gqlMock.mockResolvedValue({
      data: {
        requestPasswordReset: { success: false, message: 'No such phone' },
      },
    })
    const user = userEvent.setup()
    renderReset()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Send reset code' }))
    expect(await screen.findByText('No such phone')).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('Verification code'),
    ).not.toBeInTheDocument()
  })

  it('rejects a password mismatch with a validation toast', async () => {
    gqlMock.mockResolvedValue({
      data: {
        requestPasswordReset: {
          success: true,
          message: 'A reset code was sent to your phone.',
        },
      },
    })
    const user = userEvent.setup()
    renderReset()
    await fillPhone(user)
    await fillResetForm(user, 'different')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))
    expect(
      await screen.findByText('Passwords do not match.'),
    ).toBeInTheDocument()
    expect(gqlMock).toHaveBeenCalledTimes(1)
  })

  it('navigates to login with a notice on successful reset', async () => {
    gqlMock.mockResolvedValueOnce({
      data: {
        requestPasswordReset: {
          success: true,
          message: 'A reset code was sent to your phone.',
        },
      },
    })
    gqlMock.mockResolvedValueOnce({
      data: { resetPassword: { success: true, message: 'Password updated' } },
    })
    const user = userEvent.setup()
    renderReset()
    await fillPhone(user)
    await fillResetForm(user)
    await user.click(screen.getByRole('button', { name: 'Reset password' }))
    expect(
      await screen.findByText('Password updated. Please log in again.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Login' }),
    ).toBeInTheDocument()
  })

  it('shows an error toast when the reset fails', async () => {
    gqlMock.mockResolvedValueOnce({
      data: {
        requestPasswordReset: {
          success: true,
          message: 'A reset code was sent to your phone.',
        },
      },
    })
    gqlMock.mockResolvedValueOnce({
      data: { resetPassword: { success: false, message: 'Code expired' } },
    })
    const user = userEvent.setup()
    renderReset()
    await fillPhone(user)
    await fillResetForm(user)
    await user.click(screen.getByRole('button', { name: 'Reset password' }))
    expect(await screen.findByText('Code expired')).toBeInTheDocument()
  })
})
