import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Caught an uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    try {
      if (this.props.onReset) {
        this.props.onReset();
      }
      this.setState({ hasError: false, error: null, errorInfo: null });
    } catch {}
    window.location.reload();
  };

  private handleResetToGuest = () => {
    try {
      localStorage.removeItem('maxplay_auth_user');
      sessionStorage.clear();
      this.setState({ hasError: false, error: null, errorInfo: null });
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';

      return (
        <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#0A0A0E] text-white p-6 select-none overflow-y-auto">
          <div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl bg-[#14141B] p-6 border border-purple-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.8)] text-center">
            {/* Pulsing Alert Icon */}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-lg mb-4">
              <AlertTriangle className="h-7 w-7 stroke-[2.2]" />
            </div>

            <h2 className="text-xl font-black text-white tracking-tight">
              {this.props.fallbackTitle || 'Something Went Wrong'}
            </h2>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed max-w-[280px]">
              MaxPlay encountered a temporary glitch while loading this view. Tap below to reload safely.
            </p>

            {/* Error Detail Pill */}
            <div className="mt-3.5 w-full rounded-xl bg-black/50 p-2.5 border border-white/10 text-left overflow-hidden">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Diagnostic Error:
              </span>
              <p className="mt-0.5 text-[11px] text-zinc-300 font-mono truncate">
                {errorMessage}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex w-full flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#9333EA] to-[#C084FC] text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition hover:brightness-110 active:scale-95 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload App</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetToGuest}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300 border border-white/10 transition active:scale-95 cursor-pointer"
              >
                <Home className="h-4 w-4 text-zinc-400" />
                <span>Reset Session & Return Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
