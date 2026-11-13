import { Component } from 'react';

// Shows a friendly screen instead of a blank page if something crashes unexpectedly.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('UI error:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="loader-wrap loader-full" role="alert">
        <h2>Something went wrong</h2>
        <p>Please refresh the page. If the problem continues, contact your administrator.</p>
        <button className="btn btn-primary" onClick={() => window.location.assign('/')}>
          Back to dashboard
        </button>
      </div>
    );
  }
}
