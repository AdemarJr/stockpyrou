import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Key, 
  Shield, 
  X,
  Loader2,
  Check,
  AlertCircle,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import type { UserProfile, UserRole } from '../../types';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d`;

const roleLabels: Record<UserRole, string> = {
  superadmin: 'Super Administrador',
  admin: 'Administrador',
  gerente: 'Gerente de Estoque',
  operador: 'Operador de Cadastro',
  visualizacao: 'Somente Visualização',
};

const roleColors: Record<UserRole, string> = {
  superadmin: 'bg-red-100 text-red-800',
  admin: 'bg-purple-100 text-purple-800',
  gerente: 'bg-blue-100 text-blue-800',
  operador: 'bg-green-100 text-green-800',
  visualizacao: 'bg-gray-100 text-gray-800',
};

interface UserFormData {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  position: string;
}

export function UserManagement() {
  const { user, refreshUser } = useAuth();
  const { currentCompany } = useCompany();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [resettingPassword, setResettingPassword] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    fullName: '',
    role: 'visualizacao',
    position: '',
  });

  useEffect(() => {
    if (user?.permissions.canManageUsers && currentCompany) {
      loadUsers();
    }
  }, [user, currentCompany]);

  async function loadUsers() {
    try {
      setLoading(true);
      
      // Build URL with companyId filter if we're in a company context
      let url = `${API_URL}/users`;
      if (currentCompany) {
        url += `?companyId=${currentCompany.id}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Custom-Token': user?.accessToken || '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar usuários');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingUser) {
        const response = await fetch(`${API_URL}/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Custom-Token': user?.accessToken || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fullName: formData.fullName,
            role: formData.role,
            position: formData.position,
          }),
        });

        if (!response.ok) {
          throw new Error('Erro ao atualizar usuário');
        }

        toast.success('Usuário atualizado com sucesso!');
      } else {
        const response = await fetch(`${API_URL}/auth/signup`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user?.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao criar usuário');
        }

        toast.success('Usuário criado com sucesso!');
      }

      await loadUsers();
      await refreshUser();
      handleCloseForm();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'Erro ao salvar usuário');
    }
  }

  async function handleDelete() {
    if (!deletingUser) return;

    try {
      const response = await fetch(`${API_URL}/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Custom-Token': user?.accessToken || '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao desativar usuário');
      }

      toast.success('Usuário desativado com sucesso!');
      await loadUsers();
      setDeletingUser(null);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erro ao desativar usuário');
    }
  }

  async function handleResetPassword() {
    if (!resettingPassword || !newPassword) return;

    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/${resettingPassword.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Custom-Token': user?.accessToken || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        throw new Error('Erro ao redefinir senha');
      }

      toast.success('Senha redefinida com sucesso!');
      setResettingPassword(null);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Erro ao redefinir senha');
    }
  }

  function handleEdit(userToEdit: UserProfile) {
    setEditingUser(userToEdit);
    setFormData({
      email: userToEdit.email,
      password: '',
      fullName: userToEdit.fullName,
      role: userToEdit.role,
      position: userToEdit.position || '',
    });
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'visualizacao',
      position: '',
    });
  }

  if (!user?.permissions.canManageUsers) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-gray-900 mb-2">Acesso Restrito</h3>
        <p className="text-gray-600">
          Você não tem permissão para gerenciar usuários.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Carregando usuários...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Gerenciamento de Usuários</h2>
          <p className="text-gray-600">
            Gerencie usuários, permissões e controle de acesso ao sistema
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-gray-700">Usuário</th>
                <th className="px-6 py-4 text-left text-gray-700">E-mail</th>
                <th className="px-6 py-4 text-left text-gray-700">Cargo</th>
                <th className="px-6 py-4 text-left text-gray-700">Perfil</th>
                <th className="px-6 py-4 text-left text-gray-700">Status</th>
                <th className="px-6 py-4 text-right text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((userItem) => (
                <tr key={userItem.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                        {userItem.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-gray-900">{userItem.fullName}</p>
                        {userItem.id === user.id && (
                          <span className="text-blue-600">(Você)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{userItem.email}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {userItem.position || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full ${roleColors[userItem.role]}`}>
                      {roleLabels[userItem.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {userItem.status === 'active' ? (
                      <span className="flex items-center gap-2 text-green-600">
                        <UserCheck className="w-4 h-4" />
                        Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-red-600">
                        <UserX className="w-4 h-4" />
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(userItem)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar usuário"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setResettingPassword(userItem)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Redefinir senha"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      {userItem.id !== user.id && (
                        <button
                          onClick={() => setDeletingUser(userItem)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Desativar usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-gray-900">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button
                onClick={handleCloseForm}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={!!editingUser}
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-gray-700 mb-2">Senha</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}

              <div>
                <label className="block text-gray-700 mb-2">Cargo/Função</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Gerente, Operador..."
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Perfil de Acesso</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="visualizacao">Somente Visualização</option>
                  <option value="operador">Operador de Cadastro</option>
                  <option value="gerente">Gerente de Estoque</option>
                  <option value="admin">Administrador</option>
                  <option value="superadmin">Super Administrador</option>
                </select>
                <p className="mt-2 text-gray-600">
                  {formData.role === 'admin' && 'Acesso total ao sistema, incluindo gestão de usuários'}
                  {formData.role === 'gerente' && 'Acesso a todos os módulos, exceto gestão de usuários'}
                  {formData.role === 'operador' && 'Apenas cadastro e edição de produtos'}
                  {formData.role === 'visualizacao' && 'Apenas visualização de relatórios e estoque'}
                  {formData.role === 'superadmin' && 'Acesso total ao sistema, incluindo gestão de usuários e configurações avançadas'}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingUser ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-red-100 rounded-full p-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-gray-900">Confirmar Desativação</h3>
            </div>

            <p className="text-gray-600 mb-6">
              Tem certeza que deseja desativar o usuário <strong>{deletingUser.fullName}</strong>?
              O usuário não poderá mais acessar o sistema.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingPassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-gray-900">Redefinir Senha</h3>
              <button
                onClick={() => {
                  setResettingPassword(null);
                  setNewPassword('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Redefinindo senha para: <strong>{resettingPassword.fullName}</strong>
            </p>

            <div className="mb-6">
              <label className="block text-gray-700 mb-2">Nova Senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setResettingPassword(null);
                  setNewPassword('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!newPassword || newPassword.length < 6}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Redefinir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}