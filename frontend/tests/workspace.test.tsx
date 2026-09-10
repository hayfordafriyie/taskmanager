import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkspaceProvider } from '../src/modules/home/WorkspaceProvider'
import { AuthProvider } from '../src/modules/auth/AuthProvider'
import Home from '../src/modules/home'
import Dock from '../src/components/Dock'
import { renderWithProviders } from './test-utils'

function renderWorkspace() {
  return renderWithProviders(
    <AuthProvider>
      <WorkspaceProvider>
        <Home />
        <Dock />
      </WorkspaceProvider>
    </AuthProvider>,
  )
}

describe('Workspace', () => {
  it('defaults to the dashboard view when the page opens', () => {
    renderWorkspace()
    expect(screen.getByText(/Good (morning|afternoon|evening|night), Hayford/)).toBeInTheDocument()
    expect(screen.getByText('Upcoming tasks')).toBeInTheDocument()
    expect(screen.getByText('Tasks done today')).toBeInTheDocument()
  })

  it('renders content based on the active dock item', async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await user.click(screen.getByRole('button', { name: 'My tasks' }))
    expect(
      screen.getByRole('heading', { name: 'My tasks' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Everything assigned to you, in one place.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'My tasks' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
