import React from 'react';
import { useNavigate } from 'react-router-dom';

function ErrorFallback({ error, resetErrorBoundary }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4 opacity-60">⚠️</div>
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-4">
          We encountered an unexpected error. Please try again or return to the home page.
        </p>
        {error?.message && (
          <p className="text-sm text-gray-500 mb-4 font-mono bg-gray-100 p-2 rounded break-all">
            {error.message}
          </p>
        )}
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              resetErrorBoundary();
              navigate('/');
            }}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition"
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallbackComponent || ErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          resetErrorBoundary={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}

export { ErrorFallback };
export default ErrorBoundary;