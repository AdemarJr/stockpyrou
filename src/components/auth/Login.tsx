import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Package, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { forceLogout } from '../../utils/auth-cleanup';
import { toast } from 'sonner@2.0.3';
import logoImg from "figma:asset/e8d336438522d7b8e8099c7d47e7869928dfd8f9.png";

interface LoginProps {
  onBackToLanding?: () => void;
}

export function Login({ onBackToLanding }: LoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    const success = forceLogout();
    if (success) {
      toast.success('Sessão limpa com sucesso! Faça login novamente.');
    } else {
      toast.error('Erro ao limpar sessão');
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-100 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Lock className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-gray-900 mb-2">Recuperar Senha</h2>
            <p className="text-gray-600">
              Entre em contato com o administrador do sistema para redefinir sua senha.
            </p>
          </div>

          <button
            onClick={() => setShowForgotPassword(false)}
            className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 relative">
      {onBackToLanding && (
        <button 
          onClick={onBackToLanding}
          className="absolute top-6 left-6 flex items-center gap-2 text-gray-500 hover:text-blue-600 font-bold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para Início
        </button>
      )}

      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white text-center">
          <div className="bg-white rounded-2xl p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <img src={logoImg} alt="Logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="mb-2 text-3xl font-black">PyrouStock</h1>
          <p className="text-blue-100">Sistema de Gestão de Estoque Inteligente</p>
        </div>

        {/* Login Form */}
        <div className="p-8">
          <h2 className="text-gray-900 mb-6 text-center">Acessar Sistema</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-gray-700 mb-2">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white"
                  placeholder="seu@email.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 bg-white"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
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

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-blue-600 hover:text-blue-700 transition-colors"
                disabled={loading}
              >
                Esqueceu sua senha?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-gray-600 text-center">
              <Lock className="w-4 h-4 inline mr-1" />
              Conexão segura e criptografada
            </p>
            
            {/* Clear Session Button - for troubleshooting */}
            <button
              type="button"
              onClick={handleClearSession}
              className="mt-4 text-xs text-gray-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1 mx-auto"
              disabled={loading}
              title="Use isso se estiver com problemas de login"
            >
              <RefreshCw className="w-3 h-3" />
              Limpar sessão corrompida
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-gray-600">
        <p>© 2026 PyrouStock - Todos os direitos reservados</p>
      </div>
    </div>
  );
}