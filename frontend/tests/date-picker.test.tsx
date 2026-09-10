import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DatePicker from '../src/components/DatePicker'
import { formatDisplayDate, monthGrid } from '../src/lib/calendar'
import { renderWithProviders } from './test-utils'

describe('DatePicker', () => {
  it('formats a stored value for the trigger', () => {
    expect(formatDisplayDate('2026-09-15')).toBe('15 Sep 2026')
    expect(formatDisplayDate('')).toBe('')
    expect(formatDisplayDate('nope')).toBe('')
  })

  it('lays out a Monday-first grid with padding cells', () => {
    const weeks = monthGrid(2026, 8) // September 2026 starts on a Tuesday
    expect(weeks).toHaveLength(6)
    const first = weeks[0][0]
    expect(first).toBeNull() // Monday 31 Aug is outside September
    // Grid cells are nullable (padding cells), so the day is reached defensively.
    expect(weeks[0][1]?.toISOString().slice(0, 10)).toBe('2026-09-01')
    expect(weeks[0][6]?.toISOString().slice(0, 10)).toBe('2026-09-06')
  })

  it('shows the placeholder until a date is chosen', () => {
    renderWithProviders(<DatePicker value="" onChange={() => {}} ariaLabel="Start date" />)
    expect(screen.getByRole('button', { name: 'Start date' })).toHaveTextContent('Select date')
  })

  it('reports the picked day as YYYY-MM-DD', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DatePicker value="2026-09-15" onChange={onChange} ariaLabel="Start date" />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start date' }))
    await user.click(screen.getByRole('button', { name: '20 Sep 2026' }))
    expect(onChange).toHaveBeenCalledWith('2026-09-20')
  })

  it('never offers a day before the minimum', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DatePicker value="" onChange={onChange} min="2026-09-15" ariaLabel="End date" />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'End date' }))
    expect(screen.getByRole('button', { name: '14 Sep 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '15 Sep 2026' })).toBeEnabled()
  })

  it('never offers a day after the maximum', async () => {
    renderWithProviders(
      <DatePicker value="" onChange={() => {}} max="2026-09-15" ariaLabel="Start date" />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start date' }))
    expect(screen.getByRole('button', { name: '16 Sep 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '15 Sep 2026' })).toBeEnabled()
  })

  it('clears the value', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <DatePicker value="2026-09-15" onChange={onChange} ariaLabel="Start date" />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start date' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('moves between months', async () => {
    renderWithProviders(
      <DatePicker value="2026-09-15" onChange={() => {}} ariaLabel="Start date" />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start date' }))
    expect(screen.getByText('September 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('September 2026')).toBeInTheDocument()
  })
})
