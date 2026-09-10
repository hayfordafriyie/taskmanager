import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useToast } from '../src/components/Toast'
import ToastProvider from '../src/components/ToastProvider'

function ToastDemo() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Saved successfully', 'Saved')}>
        success
      </button>
      <button onClick={() => toast.error('Something went wrong', 'Failed')}>
        error
      </button>
      <button onClick={() => toast.info('Heads up', 'Info')}>info</button>
      <button onClick={() => toast.show({ description: 'plain text' })}>
        plain
      </button>
      <button
        onClick={() =>
          toast.show({ description: 'short lived', duration: 50 })
        }
      >
        short
      </button>
    </div>
  )
}

function renderDemo() {
  return render(
    <ToastProvider>
      <ToastDemo />
    </ToastProvider>,
  )
}

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a success toast with title and description', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'success' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Saved successfully')).toBeInTheDocument()
  })

  it('shows an error toast', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'error' }))
    expect(await screen.findByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows an info toast', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'info' }))
    expect(await screen.findByText('Info')).toBeInTheDocument()
    expect(screen.getByText('Heads up')).toBeInTheDocument()
  })

  it('falls back to default titles', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'plain' }))
    expect(await screen.findByText('Notice')).toBeInTheDocument()
    expect(screen.getByText('plain text')).toBeInTheDocument()
  })

  it('auto-dismisses after the duration elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'short' }))
    expect(await screen.findByText('short lived')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(60)
    })
    expect(screen.queryByText('short lived')).not.toBeInTheDocument()
  })

  it('auto-dismisses by default after 5 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'success' }))
    expect(await screen.findByText('Saved successfully')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Saved successfully')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument()
  })

  it('restarts the auto-dismiss timer for a replacement toast', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'success' }))
    expect(await screen.findByText('Saved successfully')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    await user.click(screen.getByRole('button', { name: 'info' }))
    expect(await screen.findByText('Heads up')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument()
    expect(screen.queryByText('Heads up')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
  })

  it('dismisses when the close button is clicked', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'success' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(screen.queryByText('Saved')).not.toBeInTheDocument(),
    )
  })

  it('replaces the previous toast when a new one is shown', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('button', { name: 'error' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'success' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByText('Something went wrong'),
      ).not.toBeInTheDocument(),
    )
  })
})
