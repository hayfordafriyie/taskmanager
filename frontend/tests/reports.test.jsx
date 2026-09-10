import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import ReportsView from '../src/modules/home/views/ReportsView'
import { renderWithProviders } from './test-utils'

vi.mock('../src/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', firstName: 'Ama', surname: 'Osei' } }),
}))

vi.mock('../src/modules/reports/hooks', () => ({
  donutGradient: (slices) =>
    slices.some((s) => s.percent > 0)
      ? `conic-gradient(#0ea5e9 0% 40%, #10b981 40% 100%)`
      : 'conic-gradient(#e4e4e7 0% 100%)',
  useReports: () => ({
    isLoading: false,
    data: {
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
    },
  }),
}))

describe('ReportsView', () => {
  it('renders API headline totals', () => {
    renderWithProviders(<ReportsView />)
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.getByText('Total tasks')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('Completion rate')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
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
