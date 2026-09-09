import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkspaceProvider } from '../src/modules/home/WorkspaceContext'
import Dock from '../src/components/Dock'

function renderDock() {
  return render(
    <WorkspaceProvider>
      <Dock />
    </WorkspaceProvider>,
  )
}

describe('Dock', () => {
  it('renders placeholder icons for task management features', () => {
    renderDock()
    const labels = [
      'Dashboard',
      'My tasks',
      'Board',
      'Calendar',
      'Inbox',
      'Goals',
      'Docs',
      'Time',
      'Reports',
      'Invite',
    ]
    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('marks the active view on the dock', () => {
    renderDock()
    expect(
      screen.getByRole('button', { name: 'Dashboard' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})