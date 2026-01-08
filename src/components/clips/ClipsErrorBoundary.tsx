"use client";

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * ClipsErrorBoundary - Graceful error handling for the clips viewport
 *
 * Catches errors from:
 * - ClipsFeed API failures
 * - SingleVideoPlayer HLS.js fatal errors
 * - React rendering errors
 *
 * Shows a friendly retry UI instead of breaking the entire page.
 */
export default class ClipsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Categorize the error for better UX messaging
    let errorMessage = 'Something went wrong loading clips.';

    if (error.message.includes('HLS')) {
      errorMessage = 'Video playback error. Please try again.';
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      errorMessage = 'Network error. Check your connection.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
    }

    this.setState({ errorInfo: errorMessage });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ClipsErrorBoundary caught error:', error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 lg:left-20 xl:left-64 flex items-center justify-center bg-black z-20">
          <div className="flex flex-col items-center gap-4 text-center px-6 max-w-sm">
            {/* Error icon */}
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white/40"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>

            {/* Error message */}
            <p className="text-white/60 text-sm">
              {this.state.errorInfo || 'Something went wrong loading clips.'}
            </p>

            {/* Retry button */}
            <button
              onClick={this.handleRetry}
              className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors active:scale-95"
            >
              Try Again
            </button>

            {/* Technical details in dev mode */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left w-full">
                <summary className="text-white/30 text-xs cursor-pointer">
                  Technical Details
                </summary>
                <pre className="mt-2 p-3 bg-white/5 rounded-lg text-white/40 text-xs overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
