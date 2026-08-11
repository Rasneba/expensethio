import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h2>Something went wrong</h2>
            <p className="muted">{this.state.error.message}</p>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
