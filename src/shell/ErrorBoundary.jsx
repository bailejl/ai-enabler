import { Component } from 'react'
import CrashScreen from './CrashScreen.jsx'
import { reportError } from './diagnostics.js'

// The one class component: React has no hook for catching a render error. It holds state and
// lifecycle only; the markup is CrashScreen's.
class ErrorBoundary extends Component {
  state = { hasCrashed: false }

  static getDerivedStateFromError() {
    return { hasCrashed: true }
  }

  componentDidCatch(error) {
    reportError('APP_RENDER_FAILED', error)
  }

  render() {
    return this.state.hasCrashed ? <CrashScreen /> : this.props.children
  }
}

export default ErrorBoundary
