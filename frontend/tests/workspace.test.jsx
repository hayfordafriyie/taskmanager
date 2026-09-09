import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkspaceProvider } from '../src/modules/home/WorkspaceContext'
import Home from '../src/modules/home'
import Dock from '../src/components/Dock'

function renderWorkspace() {
  return render(
    <WorkspaceProvider>
      <Home />
      <Dock />
    </WorkspaceProvider>,
  )
}

describe('Workspace', () => {
  it('defaults to the dashboard view when the page opens', () => {
    renderWorkspace()
    expect(
      screen.getByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('An overview of your progress is coming soon.'),
    ).toBeInTheDocument()
  })

  it('renders content based on the active dock item', async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await user.click(screen.getByRole('button', { name: 'My tasks' }))
    expect(
      screen.getByRole('heading', { name: 'My tasks' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Your personal task list is coming soon.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'My tasks' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})