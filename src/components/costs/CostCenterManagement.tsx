import { useState, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Plus, Edit2, Trash2, Folder, Tag } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import type { CostCenter } from '../../types/costs';
import { ExpenseTypeManager } from './ExpenseTypeManager';

export function CostCenterManagement() {
  const { currentCompany } = useCompany();
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: ''
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadCostCenters();
    }
  }, [currentCompany?.id]);

  const loadCostCenters = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/costs/centers`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Company-Id': currentCompany.id
          }
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Cost centers API error:', errorData);
        throw new Error(errorData.error || 'Failed to load cost centers');
      }

      const data = await res.json();
      setCenters(data.centers || []);
    } catch (error) {
      console.error('Error loading cost centers:', error);
      toast.error('Erro ao carregar centros de custo');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id) return;

    try {
      const url = editingCenter
        ? `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/costs/centers/${editingCenter.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/costs/centers`;

      const payload = editingCenter
        ? formData
        : {
            company_id: currentCompany.id,
            ...formData,
            is_active: true
          };

      console.log('Submitting cost center:', { url, method: editingCenter ? 'PUT' : 'POST', payload });

      const res = await fetch(url, {
        method: editingCenter ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          'X-Company-Id': currentCompany.id
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Save cost center API error:', errorData);
        throw new Error(errorData.error || 'Failed to save cost center');
      }

      const responseData = await res.json();
      console.log('Cost center saved successfully:', responseData);

      toast.success(
        editingCenter
          ? 'Centro de custo atualizado com sucesso!'
          : 'Centro de custo criado com sucesso!'
      );

      setDialogOpen(false);
      resetForm();
      loadCostCenters();
    } catch (error: any) {
      console.error('Error saving cost center:', error);
      toast.error(`Erro ao salvar centro de custo: ${error.message}`);
    }
  };

  const handleEdit = (center: CostCenter) => {
    setEditingCenter(center);
    setFormData({
      name: center.name,
      code: center.code,
      description: center.description || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este centro de custo?')) return;

    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/costs/centers/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Company-Id': currentCompany?.id || ''
          }
        }
      );

      if (!res.ok) throw new Error('Failed to delete cost center');

      toast.success('Centro de custo excluído com sucesso!');
      loadCostCenters();
    } catch (error) {
      console.error('Error deleting cost center:', error);
      toast.error('Erro ao excluir centro de custo');
    }
  };

  const resetForm = () => {
    setEditingCenter(null);
    setFormData({
      name: '',
      code: '',
      description: ''
    });
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-center text-gray-500">Carregando...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="centers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="centers" className="flex items-center gap-2">
            <Folder className="w-4 h-4" />
            Centros de Custo
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tipos de Despesa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="centers">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Centros de Custo
              </h2>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Centro
              </Button>
            </div>

            {centers.length === 0 ? (
              <div className="text-center py-8">
                <Folder className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum centro de custo cadastrado
                </p>
                <Button onClick={() => setDialogOpen(true)} variant="outline" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Centro
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {centers.map((center) => (
                  <Card key={center.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {center.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {center.code}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(center)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(center.id)}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    {center.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {center.description}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Card>

          {/* Dialog Form */}
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCenter ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
                </DialogTitle>
                <DialogDescription>
                  {editingCenter ? 'Atualize os detalhes do centro de custo.' : 'Crie um novo centro de custo para sua empresa.'}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: OP-001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Operacional"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição do centro de custo"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingCenter ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="types">
          <ExpenseTypeManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}