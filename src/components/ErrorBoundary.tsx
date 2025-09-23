import { Component, ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    try {
      // Hook for monitoring tools (replace with Sentry/LogRocket, etc.)
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.error('UI ErrorBoundary', error, errorInfo)
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] grid place-items-center text-sm text-muted-foreground">
          Something went wrong. Please refresh the page.
        </div>
      )
    }
    return this.props.children
  }
}

