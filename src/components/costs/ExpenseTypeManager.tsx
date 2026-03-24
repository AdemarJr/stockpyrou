import { useState, useEffect, useMemo } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { ListPaginationBar } from '../ui/list-pagination-bar';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Plus, Tag, Edit2, Trash2, Loader2, Search } from 'lucide-react';
import { rowMatchesSearch } from '../../utils/listFilters';
import { toast } from 'sonner@2.0.3';
import type { ExpenseCategory, CostCenter } from '../../types/costs';
import { CostRepository } from '../../repositories/CostRepository';

export function ExpenseTypeManager() {
  const { currentCompany } = useCompany();
  const [types, setTypes] = useState<any[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'fixo' as const,
    costCenterId: '',
    isRecurring: false,
    recurrenceDay: ''
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryListFilter, setCategoryListFilter] = useState<string>('all');
  const [costCenterListFilter, setCostCenterListFilter] = useState<string>('all');

  const filteredTypes = useMemo(() => {
    return types.filter((t: any) => {
      const ccName = t.cost_centers?.name ?? t.cost_centers_8a20b27d?.name;
      const ccId = t.cost_center_id ?? t.costCenterId ?? '';
      const matchesText = rowMatchesSearch(searchQuery, [t.name, ccName]);
      const matchesCat =
        categoryListFilter === 'all' || String(t.category) === categoryListFilter;
      const matchesCc =
        costCenterListFilter === 'all' || ccId === costCenterListFilter;
      return matchesText && matchesCat && matchesCc;
    });
  }, [types, searchQuery, categoryListFilter, costCenterListFilter]);

  const listResetKey = `${currentCompany?.id ?? ''}|${searchQuery}|${categoryListFilter}|${costCenterListFilter}`;
  const {
    paginatedItems,
    page,
    setPage,
    totalPages,
    from,
    to,
    total: pageTotal
  } = usePagination(filteredTypes, 9, listResetKey);

  useEffect(() => {
    if (currentCompany?.id) {
      loadData();
    }
  }, [currentCompany?.id]);

  const loadData = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const [typesList, centersList] = await Promise.all([
        CostRepository.findAllExpenseTypes(currentCompany.id),
        CostRepository.findAllCostCenters(currentCompany.id)
      ]);

      setTypes(typesList as any[]);
      setCenters(centersList);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id) return;

    setSubmitLoading(true);
    try {
      const recurrenceDay = formData.recurrenceDay
        ? parseInt(formData.recurrenceDay, 10)
        : undefined;

      if (editingType) {
        await CostRepository.updateExpenseType(editingType.id, {
          name: formData.name,
          category: formData.category as ExpenseCategory,
          costCenterId: formData.costCenterId,
          isRecurring: formData.isRecurring,
          recurrenceDay: formData.isRecurring ? recurrenceDay : undefined,
          isActive: true
        });
      } else {
        await CostRepository.createExpenseType({
          companyId: currentCompany.id,
          name: formData.name,
          category: formData.category as ExpenseCategory,
          costCenterId: formData.costCenterId,
          isRecurring: formData.isRecurring,
          recurrenceDay: formData.isRecurring ? recurrenceDay : undefined,
          isActive: true
        });
      }

      toast.success(
        editingType
          ? 'Tipo de despesa atualizado!'
          : 'Tipo de despesa criado!'
      );

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: unknown) {
      console.error('Error saving expense type:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao salvar';
      toast.error(`Erro ao salvar tipo de despesa: ${msg}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = (type: any) => {
    setEditingType(type);
    const ccId = type.cost_center_id ?? type.costCenterId ?? '';
    setFormData({
      name: type.name,
      category: type.category,
      costCenterId: ccId,
      isRecurring: type.is_recurring ?? type.isRecurring ?? false,
      recurrenceDay:
        (type.recurrence_day ?? type.recurrenceDay)?.toString?.() || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (type: any) => {
    if (!currentCompany?.id) return;
    
    if (!confirm(`Tem certeza que deseja excluir o tipo de despesa "${type.name}"?`)) {
      return;
    }

    setDeletingId(type.id);
    try {
      await CostRepository.deleteExpenseType(type.id);
      toast.success('Tipo de despesa excluído!');
      loadData();
    } catch (error: unknown) {
      console.error('Error deleting expense type:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao excluir';
      toast.error(`Erro ao excluir tipo de despesa: ${msg}`);
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setEditingType(null);
    setFormData({
      name: '',
      category: 'fixo',
      costCenterId: '',
      isRecurring: false,
      recurrenceDay: ''
    });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      fixo: 'Fixo',
      variavel: 'Variável',
      semi_variavel: 'Semi-variável'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      fixo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      variavel: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      semi_variavel: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
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
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Tipos de Despesa
          </h2>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Tipo
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-muted/20">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Buscar cadastro</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Nome do tipo ou centro de custo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={categoryListFilter} onValueChange={setCategoryListFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="fixo">Fixo</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
                <SelectItem value="semi_variavel">Semi-variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Centro de custo</Label>
            <Select value={costCenterListFilter} onValueChange={setCostCenterListFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {centers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {types.length === 0 ? (
          <div className="text-center py-8">
            <Tag className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum tipo de despesa cadastrado
            </p>
          </div>
        ) : filteredTypes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum tipo corresponde aos filtros.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map((type: any) => (
              <Card key={type.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {type.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {type.cost_centers?.name ?? type.cost_centers_8a20b27d?.name}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(type)}
                      disabled={deletingId !== null}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(type)}
                      disabled={deletingId !== null}
                    >
                      {deletingId === type.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(type.category)}`}>
                    {getCategoryLabel(type.category)}
                  </span>
                  {type.is_recurring && (
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      Recorrente (dia {type.recurrence_day})
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
        {filteredTypes.length > 0 && totalPages > 1 && (
          <ListPaginationBar
            page={page}
            totalPages={totalPages}
            from={from}
            to={to}
            total={pageTotal}
            onPageChange={setPage}
            className="mt-4"
          />
        )}
      </Card>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Editar Tipo de Despesa' : 'Novo Tipo de Despesa'}
            </DialogTitle>
            <DialogDescription>
              {editingType ? 'Atualize as informações do tipo de despesa.' : 'Crie um novo tipo de despesa para categorizar seus gastos.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Aluguel, Energia, Salários"
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Categoria *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">Fixo</SelectItem>
                  <SelectItem value="variavel">Variável</SelectItem>
                  <SelectItem value="semi_variavel">Semi-variável</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Fixo: valor constante | Variável: varia com produção | Semi-variável: misto
              </p>
            </div>

            <div>
              <Label htmlFor="costCenter">Centro de Custo *</Label>
              <Select
                value={formData.costCenterId}
                onValueChange={(value) => setFormData({ ...formData, costCenterId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {centers.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name} ({center.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="recurring">Despesa Recorrente</Label>
                <p className="text-xs text-gray-500">
                  Despesa que se repete mensalmente
                </p>
              </div>
              <Switch
                id="recurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
              />
            </div>

            {formData.isRecurring && (
              <div>
                <Label htmlFor="recurrenceDay">Dia do Vencimento</Label>
                <Input
                  id="recurrenceDay"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.recurrenceDay}
                  onChange={(e) => setFormData({ ...formData, recurrenceDay: e.target.value })}
                  placeholder="Ex: 5 (todo dia 5 do mês)"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {editingType ? 'Salvando…' : 'Criando…'}
                  </>
                ) : editingType ? (
                  'Atualizar'
                ) : (
                  'Criar'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}