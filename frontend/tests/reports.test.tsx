import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import ReportsView from '../src/modules/home/views/ReportsView'
import type { WorkspaceReports } from '../src/types/reports'
import { renderWithProviders } from './test-utils'

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', firstName: 'Ama', surname: 'Osei' } }),
}))

vi.mock('../src/modules/reports/hooks', () => {
  const reports: WorkspaceReports = {
    completedPerDay: [
      { label: 'Mon', value: 3 },
      { label: 'Tue', value: 5 },
    ],
    byStatus: [
      { key: 'TODO', label: 'To do', count: 2, percent: 20 },
      { key: 'IN_PROGRESS', label: 'In progress', count: 1, percent: 10 },
      { key: 'REVIEW', label: 'Review', count: 1, percent: 10 },
      { key: 'DONE', label: 'Done', count: 6, percent: 60 },
    ],
    workload: [
      { userId: 'u-1', name: 'Ama Osei', initials: 'AO', open: 3, done: 2, total: 5, percent: 75 },
      { userId: 'u-2', name: 'Kojo Afriyie', initials: 'KA', open: 1, done: 0, total: 1, percent: 25 },
    ],
    totalTasks: 10,
    completedTasks: 6,
    overdueTasks: 1,
    completionRate: 60,
  }

  return {
    useReports: () => ({
      isLoading: false,
      data: reports,
    }),
  }
})

describe('ReportsView', () => {
  it('renders API headline totals', () => {
    renderWithProviders(<ReportsView />)
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()

    // Read each headline through its own card: the donut centre and legend reuse
    // the same numbers, so a bare text query would be ambiguous.
    const stat = (label: string): string =>
      screen.getByText(label).parentElement?.textContent ?? ''
    expect(stat('Total tasks')).toContain('10')
    expect(stat('Completed')).toContain('6')
    expect(stat('Overdue')).toContain('1')
    expect(stat('Completion rate')).toContain('60%')
  })

  it('renders the completion chart, status mix and workload rows', () => {
    renderWithProviders(<ReportsView />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()

    expect(screen.getByText('Ama Osei')).toBeInTheDocument()
    expect(screen.getByText('Kojo Afriyie')).toBeInTheDocument()
    expect(screen.getByText('3 open · 2 done')).toBeInTheDocument()
    expect(screen.getByText('1 open · 0 done')).toBeInTheDocument()
  })
})
