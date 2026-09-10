import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Select from '../src/components/Select'
import { MemberChip, initialsOf, personName } from '../src/modules/home/ui'
import { renderWithProviders } from './test-utils'

const LONG_NAME = {
  id: 'u-9',
  firstName: 'Kwabena',
  surname: 'Nkrumah-Agyeman Mensah',
}

describe('member name helpers', () => {
  it('builds initials and falls back safely', () => {
    expect(initialsOf(LONG_NAME)).toBe('KN')
    expect(initialsOf({ firstName: 'Ama', surname: 'Osei' })).toBe('AO')
    expect(initialsOf({ firstName: 'Ama' })).toBe('A')
    expect(initialsOf(null, '–')).toBe('–')
    expect(initialsOf({}, '–')).toBe('–')
  })

  it('joins the display name and handles a missing person', () => {
    expect(personName(LONG_NAME)).toBe('Kwabena Nkrumah-Agyeman Mensah')
    expect(personName(null)).toBe('')
  })
})

describe('MemberChip', () => {
  it('shows initials only when compact, full name in the tooltip', () => {
    renderWithProviders(<MemberChip member={LONG_NAME} compact />)
    expect(screen.getByText('KN')).toBeInTheDocument()
    expect(screen.queryByText(LONG_NAME.surname)).not.toBeInTheDocument()
    expect(screen.getByTitle('Kwabena Nkrumah-Agyeman Mensah')).toBeInTheDocument()
  })

  it('shows initials plus a truncated name when not compact', () => {
    renderWithProviders(<MemberChip member={LONG_NAME} />)
    expect(screen.getByText('KN')).toBeInTheDocument()
    expect(screen.getByText('Kwabena Nkrumah-Agyeman Mensah')).toHaveClass('truncate')
  })

  it('falls back to the placeholder for an unassigned slot', () => {
    renderWithProviders(<MemberChip member={null} />)
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })
})

describe('Select with a custom value renderer', () => {
  const options = [
    { value: 'none', label: 'Unassigned', member: null },
    { value: 'u-9', label: 'Kwabena Nkrumah-Agyeman Mensah', member: LONG_NAME },
  ]

  it('keeps a long name out of the trigger but in the DOM for a11y', () => {
    renderWithProviders(
      <Select
        value="u-9"
        onValueChange={() => {}}
        options={options}
        ariaLabel="Assignee"
        renderValue={<MemberChip member={LONG_NAME} compact />}
        renderOption={(o) => <MemberChip member={o.member} />}
      />,
    )
    const trigger = screen.getByRole('combobox', { name: 'Assignee' })
    // The trigger body shows only the rounded initials…
    expect(trigger).toHaveTextContent('KN')
    // …while the full name survives only as visually hidden text (a11y), so it
    // never occupies layout space.
    // The initials badge is rendered as a rounded chip…
    const badge = trigger.querySelector('span.rounded-full')
    expect(badge).not.toBeNull()
    expect(badge.textContent.trim()).toBe('KN')
    // …and in compact mode the laid-out wrapper holds the initials only (the
    // full name survives solely in hidden nodes: Radix value + native select).
    expect(badge.closest('.truncate').textContent.trim()).toBe('KN')
  })

  it('lists the members with initials in the dropdown', async () => {
    renderWithProviders(
      <Select
        value="none"
        onValueChange={() => {}}
        options={options}
        ariaLabel="Assignee"
        renderValue={<MemberChip member={null} compact />}
        renderOption={(o) => <MemberChip member={o.member} />}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Assignee' }))
    const row = await screen.findByRole('option', { name: /Kwabena Nkrumah-Agyeman Mensah/ })
    expect(row).toBeInTheDocument()
    expect(row).toHaveTextContent('KN')
  })
})
