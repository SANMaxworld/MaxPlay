import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onBack?: () => void;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DetailErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[DetailErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center select-none bg-[#09090b]">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-900/30">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-white mb-2">Unable to display content</h2>
          <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
            {this.state.error?.message || 'An unexpected render issue occurred while loading this title.'}
          </p>
          <div className="flex items-center gap-3">
            {this.props.onBack && (
              <button
                type="button"
                onClick={this.props.onBack}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition active:scale-95 cursor-pointer border border-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Go Back</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-lg shadow-purple-900/40"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
