import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, margin: '24px auto', maxWidth: 600, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: 'var(--text-primary)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--accent-red)' }}>Something went wrong</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            An unexpected error occurred while rendering this component.
          </p>
          <pre style={{ padding: 12, background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, overflowX: 'auto', color: 'var(--text-secondary)' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ marginTop: 12, height: 28, minHeight: 28, borderRadius: 4 }}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
