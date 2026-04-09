import React, { useState } from 'react';
import { Building2, Plus, LogOut, ArrowRight } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { APP_NAME } from '../../config/branding';

export function CompanySelection() {
  const { companies, selectCompany, createCompany, isLoading } = useCompany();
  const { logout, user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setIsSubmitting(true);
    try {
      await createCompany(newCompanyName);
      // Auto selection happens inside createCompany
    } catch (error) {
      console.error('Failed to create company', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-xl">
            <Building2 className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Bem-vindo ao {APP_NAME}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {user?.email}
          {user?.role === 'superadmin' && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              🔐 Superadmin
            </span>
          )}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {!isCreating ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {user?.role === 'superadmin' ? 'Todas as Empresas do Sistema' : 'Suas Empresas'}
                </h3>
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="text-sm text-blue-600 hover:text-blue-500 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Nova Empresa
                  </button>
                )}
              </div>

              {user?.role === 'superadmin' && companies.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-sm text-purple-800">
                    🔑 <strong>Modo Superadmin:</strong> Você tem acesso total a todas as {companies.length} empresas cadastradas no sistema.
                  </p>
                </div>
              )}

              {companies.length > 0 ? (
                <div className="space-y-3">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={async () => {
                        const success = await selectCompany(company.id);
                        if (!success) {
                          // selectCompany already handles the error toast
                        }
                      }}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:ring-1 hover:ring-blue-500 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{company.name}</p>
                          <p className="text-sm text-gray-500">
                            Criada em {new Date(company.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma empresa encontrada</h3>
                  
                  {(user?.role === 'admin' || user?.role === 'superadmin') ? (
                    <>
                      <p className="mt-1 text-sm text-gray-500">Comece criando sua primeira organização.</p>
                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={() => setIsCreating(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                          Criar Empresa
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">
                      Você ainda não foi vinculado a nenhuma empresa. Entre em contato com o administrador.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-6 border-t pt-4">
                <button
                  onClick={() => logout()}
                  className="w-full flex justify-center items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da conta
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Nova Empresa</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Configure os dados da sua nova organização.
                </p>
              </div>

              <form onSubmit={handleCreate} className="space-y-6">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                    Nome da Empresa
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="companyName"
                      required
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Ex: Mercado Silva Matriz"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Criando...' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}