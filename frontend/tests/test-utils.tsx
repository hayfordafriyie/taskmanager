import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ToastProvider from '../src/components/Toast'

export interface RenderWithProvidersOptions {
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient }: RenderWithProvidersOptions = {},
) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  return {
    queryClient: client,
    ...render(
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>,
    ),
  }
}
