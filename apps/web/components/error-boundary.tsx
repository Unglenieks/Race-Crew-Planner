"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = Readonly<{
  /** Rendered when a descendant throws. Receives a retry callback. */
  fallback: (retry: () => void) => ReactNode;
  children: ReactNode;
}>;

type ErrorBoundaryState = { hasError: boolean };

/**
 * Contains a client-side render failure to one region of the page.
 *
 * Convex `useQuery` throws when its backend rejects a query, so an unwrapped
 * data panel takes the whole route down to the framework error screen. Error
 * details are logged rather than rendered because they can echo backend
 * payloads.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "Contained client-side error",
      error,
      errorInfo.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(() => this.setState({ hasError: false }));
    }

    return this.props.children;
  }
}
