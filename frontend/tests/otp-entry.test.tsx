import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OtpEntry from '../src/components/OtpEntry'

describe('OtpEntry', () => {
  // Matches `OtpEntryProps['onResend']` (`() => Promise<boolean | undefined>`).
  const onResend = vi.fn<() => Promise<boolean>>()

  beforeEach(() => {
    onResend.mockReset()
    onResend.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the code input and a disabled resend button with countdown', () => {
    render(<OtpEntry value="" onChange={() => {}} onResend={onResend} />)
    expect(
      screen.getByPlaceholderText('Verification code'),
    ).toBeInTheDocument()
    const resend = screen.getByRole('button', { name: /Resend code/ })
    expect(resend).toBeDisabled()
    expect(resend).toHaveTextContent('60s')
  })

  it('counts down in real time and re-enables resend after the cooldown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<OtpEntry value="" onChange={() => {}} onResend={onResend} />)
    const resend = screen.getByRole('button', { name: /Resend code/ })
    expect(resend).toHaveTextContent('60s')
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(resend).toHaveTextContent('57s')
    await act(async () => {
      vi.advanceTimersByTime(57000)
    })
    expect(resend).toBeEnabled()
    expect(resend).toHaveTextContent('Resend code')
  })

  it('sends the code and restarts the countdown after a successful resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<OtpEntry value="" onChange={() => {}} onResend={onResend} />)
    const resend = screen.getByRole('button', { name: /Resend code/ })
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    await waitFor(() => expect(resend).toBeEnabled())
    await user.click(resend)
    expect(onResend).toHaveBeenCalledTimes(1)
    expect(resend).toBeDisabled()
    expect(resend).toHaveTextContent('60s')
  })

  it('does not restart the countdown when the resend fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    onResend.mockResolvedValue(false)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<OtpEntry value="" onChange={() => {}} onResend={onResend} />)
    const resend = screen.getByRole('button', { name: /Resend code/ })
    await act(async () => {
      vi.advanceTimersByTime(30000)
    })
    expect(resend).toHaveTextContent('30s')
    await act(async () => {
      vi.advanceTimersByTime(30000)
    })
    await user.click(resend)
    expect(onResend).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(resend).toBeEnabled())
    expect(resend).toHaveTextContent('Resend code')
  })
})
