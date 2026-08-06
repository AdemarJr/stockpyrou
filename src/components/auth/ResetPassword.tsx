import React, { useMemo, useState } from 'react';
import { Lock, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getBackendApiRoot } from '../../lib/backendUrl';
import { APP_NAME } from '../../config/branding';
import { cn } from '../ui/utils';
import { nativeFieldInvalidClass } from '../../lib/formFieldValidation';

const API_URL = getBackendApiRoot();

interface ResetPasswordProps {
  token: string;
  onDone: () => void;
  onBackToLogin: () => void;
}

export function ResetPassword({ token, onDone, onBackToLogin }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: boolean; confirm?: boolean }>({});

  const tokenOk = useMemo(() => !!token.trim(), [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: { password?: boolean; confirm?: boolean } = {};
    if (!password || password.length < 6) err.password = true;
    if (confirm !== password) err.confirm = true;
    setFieldErrors(err);
    if (Object.keys(err).length > 0) {
      if (err.password) toast.error('A senha deve ter no mínimo 6 caracteres');
      else if (err.confirm) toast.error('As senhas não coincidem');
      return;
    }
    if (!tokenOk) {
      toast.error('Link inválido. Solicite uma nova recuperação de senha.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível redefinir a senha');
      }
      toast.success(data.message || 'Senha redefinida com sucesso!');
      onDone();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao redefinir senha';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <button
          type="button"
          onClick={onBackToLogin}
          className="mb-6 flex items-center gap-2 text-gray-500 hover:text-blue-600 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </button>

        <div className="text-center mb-8">
          <div className="bg-blue-100 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <Lock className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-gray-900 mb-2 text-xl font-bold">Nova senha</h2>
          <p className="text-gray-600 text-sm">
            Defina uma nova senha para acessar o {APP_NAME}.
          </p>
        </div>

        {!tokenOk ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4">
            Link inválido ou incompleto. Solicite uma nova recuperação na tela de login.
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border border-gray-300 px-4 py-3 pr-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    nativeFieldInvalidClass(!!fieldErrors.password),
                  )}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={cn(
                  'w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                  nativeFieldInvalidClass(!!fieldErrors.confirm),
                )}
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar nova senha'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
