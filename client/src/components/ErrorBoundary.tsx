import { Component, ReactNode } from 'react';
import { motion } from 'framer-motion';

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
          <motion.div
            className="card"
            style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 420, margin: '80px auto' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
            <h2 style={{ marginBottom: 8, fontSize: 20 }}>Something went wrong</h2>
            <p className="muted" style={{ marginBottom: 24 }}>{this.state.error.message}</p>
            <button
              className="btn primary"
              style={{ maxWidth: 200, margin: '0 auto' }}
              onClick={() => window.location.reload()}
            >
              Reload App
            </button>
          </motion.div>
        </div>
      );
    }
    return this.props.children;
  }
}
