import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DonutChart from '../src/components/DonutChart'
import { renderWithProviders } from './test-utils'

const DATA = [
  { key: 'TODO', label: 'To do', count: 6, color: '#a1a1aa' },
  { key: 'IN_PROGRESS', label: 'In progress', count: 3, color: '#0ea5e9' },
  { key: 'DONE', label: 'Done', count: 1, color: '#10b981' },
]

describe('DonutChart', () => {
  it('draws a ring with one arc per non-empty slice (a donut, not a pie)', () => {
    const { container } = renderWithProviders(<DonutChart data={DATA} />)

    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(3)
    // every arc is stroked and unfilled: the middle stays open for the headline
    for (const arc of circles) {
      expect(arc.getAttribute('fill')).toBe('none')
      expect(Number(arc.getAttribute('stroke-width'))).toBeGreaterThan(0)
      expect(arc.getAttribute('stroke-dasharray')).toBeTruthy()
    }
  })

  it('sums the total in the hole and shows counts with percentages in the legend', () => {
    renderWithProviders(<DonutChart data={DATA} />)

    expect(screen.getByText('10')).toBeInTheDocument() // 6 + 3 + 1
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })

  it('highlights a slice when the legend row is hovered', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<DonutChart data={DATA} />)

    const before = Array.from(container.querySelectorAll('circle')).map((c) =>
      Number(c.getAttribute('stroke-width')),
    )

    await user.hover(screen.getByText('In progress'))

    const after = Array.from(container.querySelectorAll('circle')).map((c) =>
      Number(c.getAttribute('stroke-width')),
    )
    const highlighted = after.findIndex((w, i) => w > before[i])
    expect(highlighted).toBe(1) // the "In progress" arc, not the others
  })

  it('explains an empty workspace instead of rendering a blank ring', () => {
    renderWithProviders(
      <DonutChart data={DATA.map((d) => ({ ...d, count: 0 }))} />,
    )
    expect(screen.getByText(/No tasks yet/i)).toBeInTheDocument()
  })
})
