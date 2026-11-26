import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-2xl mx-auto my-12 p-6 bg-[#211C1A] border border-[#C6A46A]/35 rounded-lg space-y-3 text-[#F3EBDD]">
          <h2 className="font-display text-2xl font-medium text-[#C6A46A]">
            Something went wrong
          </h2>
          <p className="text-sm text-[#D2C6B5] break-words">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({hasError: false, message: ''})}
            className="px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
