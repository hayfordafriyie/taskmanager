import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ToastProvider from '../src/components/Toast'
import Login from '../src/modules/login'

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }))

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({
    login: loginMock,
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
    initializing: false,
  }),
}))

function renderLogin(state) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>home page</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

async function fillCredentials(user, phone = '0537144161', password = 'secret') {
  await user.type(screen.getByRole('textbox'), phone)
  await user.type(screen.getByPlaceholderText('Password'), password)
}

describe('Login', () => {
  beforeEach(() => {
    loginMock.mockReset()
    loginMock.mockResolvedValue({ success: false, message: 'Login failed' })
  })

  it('renders the form fields and heading', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('disables the submit button until phone and password are provided', async () => {
    const user = userEvent.setup()
    renderLogin()
    const submit = screen.getByRole('button', { name: 'Login' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByRole('textbox'), '0537144161')
    expect(submit).toBeDisabled()
    await user.type(screen.getByPlaceholderText('Password'), 'secret')
    expect(submit).toBeEnabled()
  })

  it('shows a validation toast when the empty form is submitted', async () => {
    const { container } = renderLogin()
    fireEvent.submit(container.querySelector('form'))
    expect(
      await screen.findByText('Phone and password are required.'),
    ).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('navigates home on successful login', async () => {
    loginMock.mockResolvedValue({
      success: true,
      user: { id: '1', phone: '+233537144161' },
    })
    const user = userEvent.setup()
    renderLogin()
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(loginMock).toHaveBeenCalledWith('+233537144161', 'secret')
    expect(await screen.findByText('home page')).toBeInTheDocument()
  })

  it('shows the API error message on failed login', async () => {
    loginMock.mockResolvedValue({
      success: false,
      message: 'Invalid credentials',
    })
    const user = userEvent.setup()
    renderLogin()
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
    expect(screen.queryByText('home page')).not.toBeInTheDocument()
  })

  it('shows the thrown error message', async () => {
    loginMock.mockRejectedValue(new Error('Network down'))
    const user = userEvent.setup()
    renderLogin()
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByText('Network down')).toBeInTheDocument()
  })

  it('surfaces the notice from navigation state as an info toast', async () => {
    renderLogin({ notice: 'Password updated. Please log in again.' })
    expect(
      await screen.findByText('Password updated. Please log in again.'),
    ).toBeInTheDocument()
  })
})