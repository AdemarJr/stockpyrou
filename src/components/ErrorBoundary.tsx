import React from 'react';

type Props = {
  children: React.ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Mantém log no console para diagnóstico rápido
    console.error('[UI ErrorBoundary] Uncaught render error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || 'Erro desconhecido';
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white border border-red-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-red-700">
            {this.props.title || 'Ocorreu um erro na tela'}
          </h2>
          <p className="text-sm text-gray-700 mt-2 break-words">{message}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Tentar continuar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Abra o console do navegador para ver o stack trace.
          </p>
        </div>
      </div>
    );
  }
}

