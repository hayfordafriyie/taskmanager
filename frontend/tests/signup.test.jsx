import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ToastProvider from '../src/components/Toast'
import Signup from '../src/pages/signup'

const { gqlMock } = vi.hoisted(() => ({ gqlMock: vi.fn() }))

vi.mock('../src/lib/api', () => ({
  gql: gqlMock,
  clearTokens: vi.fn(),
  setTokens: vi.fn(),
}))

function renderSignup() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('Signup', () => {
  beforeEach(() => {
    gqlMock.mockReset()
  })

  it('renders heading, phone input and submit button', () => {
    renderSignup()
    expect(screen.getByRole('heading', { name: 'Signup' })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Request code' }),
    ).toBeInTheDocument()
  })

  it('disables the submit button until a phone is provided', async () => {
    const user = userEvent.setup()
    renderSignup()
    const submit = screen.getByRole('button', { name: 'Request code' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByRole('textbox'), '0537144161')
    expect(submit).toBeEnabled()
  })

  it('shows a validation toast when the empty form is submitted', async () => {
    const { container } = renderSignup()
    fireEvent.submit(container.querySelector('form'))
    expect(
      await screen.findByText('Enter your phone number first.'),
    ).toBeInTheDocument()
    expect(gqlMock).not.toHaveBeenCalled()
  })

  it('shows a success toast and sends the code', async () => {
    gqlMock.mockResolvedValue({
      data: {
        requestOTP: { success: true, message: 'Code sent to your phone.' },
      },
    })
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Request code' }))
    expect(await screen.findByText('Code sent to your phone.')).toBeInTheDocument()
    expect(gqlMock).toHaveBeenCalledWith(
      'mutation ($phone: String!) { requestOTP(phone: $phone) { success message expiresInSeconds retryAfterSeconds } }',
      { phone: '+233537144161' },
    )
  })

  it('shows an error toast when the API rejects the request', async () => {
    gqlMock.mockResolvedValue({
      data: { requestOTP: { success: false, message: 'Rate limited' } },
    })
    const user = userEvent.setup()
    renderSignup()
    await user.type(screen.getByRole('textbox'), '0537144161')
    await user.click(screen.getByRole('button', { name: 'Request code' }))
    expect(await screen.findByText('Rate limited')).toBeInTheDocument()
  })

  it('shows the thrown error message', async () => {
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