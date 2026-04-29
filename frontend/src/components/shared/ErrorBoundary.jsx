import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md text-sm">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      )
    }
    return this.props.children
  }
}
