import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class PageErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[PageErrorBoundary:${this.props.pageName ?? 'Page'}]`, error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          data-testid="page-error-boundary"
          className="min-h-full flex flex-col items-center justify-center px-8 py-16 text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="space-y-1 max-w-md">
            <h2 className="text-lg font-semibold text-white">
              {this.props.pageName ? `${this.props.pageName} encountered an error` : 'Something went wrong'}
            </h2>
            <p className="text-sm text-white/55">{this.state.errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#0a0a0a] text-sm font-medium hover:bg-white/90 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
