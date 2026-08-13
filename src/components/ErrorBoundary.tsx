import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { MdErrorOutline, MdRefresh } from 'react-icons/md';

interface Props {
  children: ReactNode;
  /** Optional fallback — defaults to the built-in crash screen */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches unhandled render-time errors anywhere in the subtree and shows a
 * safe recovery screen instead of a blank/crashed page.
 *
 * React error boundaries must be class components.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // In production you would send this to a logging service here.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-100">
            <MdErrorOutline className="h-7 w-7 text-danger-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Something went wrong</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">{this.state.message}</p>
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-paper-100"
          >
            <MdRefresh className="h-4 w-4" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
