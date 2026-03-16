import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, Loader2, ArrowLeft, Terminal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';

interface AdminLoginProps {
  onBack: () => void;
}

export function AdminLogin({ onBack }: AdminLoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      // Se sucesso, o AuthContext vai atualizar o user e o App vai redirecionar
    } catch (error: any) {
      console.error('Admin Login Error:', error);
      toast.error('Credenciais inválidas ou acesso negado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative font-sans">
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </button>

      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-8 text-center border-b border-slate-700">
          <div className="bg-slate-800 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center shadow-lg border border-slate-600">
            <ShieldCheck className="w-10 h-10 text-indigo-500" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white tracking-wide">Painel Administrativo</h1>
          <p className="text-slate-400 text-sm">Acesso Restrito - Super Admin</p>
        </div>

        {/* Login Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="admin-email" className="block text-slate-300 mb-2 text-sm font-medium">
                ID de Administrador
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Terminal className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded bg-slate-900 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="email@email.com"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="admin-password" className="block text-slate-300 mb-2 text-sm font-medium">
                Chave de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-slate-600 rounded bg-slate-900 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded font-medium hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Autenticando...
                </>
              ) : (
                'Acessar Painel'
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-8 pt-6 border-t border-slate-700 text-center">
             <p className="text-xs text-slate-500 font-mono">
               SECURITY LEVEL: HIGH<br/>
               IP LOGGED AND MONITORED
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}