import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithProviders } from './test-utils'
import Signup from '../src/modules/signup'
import Login from '../src/modules/login'

const { gqlMock } = vi.hoisted(() => ({ gqlMock: vi.fn() }))

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

function renderSignup() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>,
  )
}

const requestOtpQuery =
  'mutation ($phone: String!) { requestOTP(phone: $phone) { success message expiresInSeconds retryAfterSeconds } }'
const verifyOtpQuery =
  'mutation ($phone: String!, $code: String!) { verifyOTP(phone: $phone, code: $code) { success message } }'
const createAccountQuery =
  'mutation ($input: CreateAccountInput!) { createAccount(input: $input) { success message user { id phone firstName surname otherNames } } }'

describe('Signup', () => {
  beforeEach(() => {
    gqlMock.mockReset()
  })

  it('shows a validation toast when the empty form is submitted', async () => {
    const { container } = renderSignup()
    fireEvent.submit(container.querySelector('form'))
    expect(
      await screen.findByText('Enter your phone number first.'),
    ).toBeInTheDocument()
    expect(gqlMock).not.toHaveBeenCalled()
  })

  it('requests a code then moves to the OTP step', async () => {
    gqlMock.mockResolvedValue({
      data: { requestOTP: { success: true, message: 'Code sent to your phone.' } },
    })
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Request code' }))
    expect(await screen.findByText('Code sent to your phone.')).toBeInTheDocument()
    expect(gqlMock).toHaveBeenCalledWith(requestOtpQuery, { phone: '+233537144161' })
    expect(
      screen.getByPlaceholderText('Verification code'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Verify code' }),
    ).toBeInTheDocument()
  })

  it('verifies the code then moves to the account step', async () => {
    gqlMock
      .mockResolvedValueOnce({
        data: {
          requestOTP: { success: true, message: 'Code sent to your phone.' },
        },
      })
      .mockResolvedValueOnce({
        data: { verifyOTP: { success: true, message: 'Phone verified.' } },
      })
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Request code' }))
    await screen.findByPlaceholderText('Verification code')
    await user.type(screen.getByPlaceholderText('Verification code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify code' }))
    expect(await screen.findByText('Phone verified.')).toBeInTheDocument()
    expect(gqlMock).toHaveBeenLastCalledWith(verifyOtpQuery, {
      phone: '+233537144161',
      code: '123456',
    })
    expect(screen.getByPlaceholderText('First name')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create account' }),
    ).toBeInTheDocument()
  })

  it('shows an error toast when the code is rejected', async () => {
    gqlMock
      .mockResolvedValueOnce({
        data: {
          requestOTP: { success: true, message: 'Code sent to your phone.' },
        },
      })
      .mockResolvedValueOnce({
        data: { verifyOTP: { success: false, message: 'Code is invalid' } },
      })
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Request code' }))
    await screen.findByPlaceholderText('Verification code')
    await user.type(screen.getByPlaceholderText('Verification code'), '000000')
    await user.click(screen.getByRole('button', { name: 'Verify code' }))
    expect(
      await screen.findByText('Code is invalid'),
    ).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('First name'),
    ).not.toBeInTheDocument()
  })

  it('creates the account and redirects to login with a notice', async () => {
    gqlMock
      .mockResolvedValueOnce({
        data: {
          requestOTP: { success: true, message: 'Code sent to your phone.' },
        },
      })
      .mockResolvedValueOnce({
        data: { verifyOTP: { success: true, message: 'Phone verified.' } },
      })
      .mockResolvedValueOnce({
        data: {
          createAccount: {
            success: true,
            message: 'Account created',
            user: { id: 'u1', phone: '+233537144161' },
          },
        },
      })
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Request code' }))
    await screen.findByPlaceholderText('Verification code')
    await user.type(screen.getByPlaceholderText('Verification code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify code' }))
    await screen.findByPlaceholderText('First name')
    await user.type(screen.getByPlaceholderText('First name'), 'Ama')
    await user.type(screen.getByPlaceholderText('Surname'), 'Osei')
    await user.type(screen.getByPlaceholderText('Password'), 'Secret123!')
    await user.type(
      screen.getByPlaceholderText('Confirm password'),
      'Secret123!',
    )
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(gqlMock).toHaveBeenLastCalledWith(createAccountQuery, {
      input: {
        phone: '+233537144161',
        firstName: 'Ama',
        surname: 'Osei',
        otherNames: null,
        password: 'Secret123!',
        confirmPassword: 'Secret123!',
      },
    })
    expect(
      await screen.findByText('Account created. Please log in.'),
    ).toBeInTheDocument()
  })

  it('shows an error toast when the API rejects the code request', async () => {
    gqlMock.mockResolvedValue({
      data: { requestOTP: { success: false, message: 'Rate limited' } },
    })
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Request code' }))
    expect(await screen.findByText('Rate limited')).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('Verification code'),
    ).not.toBeInTheDocument()
  })

  it('shows a thrown error message', async () => {
    gqlMock.mockRejectedValue(new Error('SMS service unavailable'))
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Request code' }))
    expect(
      await screen.findByText('SMS service unavailable'),
    ).toBeInTheDocument()
  })
})