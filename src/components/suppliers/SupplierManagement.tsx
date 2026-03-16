import { useState } from "react";
import { Supplier } from "../../types";
import { SupplierList } from "./SupplierList";
import { SupplierForm } from "./SupplierForm";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Plus } from "lucide-react";

interface SupplierManagementProps {
  suppliers: Supplier[];
  onSave: (supplier: any) => Promise<void>;
  onUpdate: (id: string, supplier: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function SupplierManagement({ suppliers, onSave, onUpdate, onDelete }: SupplierManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  function handleAddNew() {
    setEditingSupplier(undefined);
    setIsModalOpen(true);
  }

  function handleEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este fornecedor?")) return;
    await onDelete(id);
  }

  async function handleSubmit(data: any) {
    try {
      setIsSaving(true);
      if (editingSupplier) {
        await onUpdate(editingSupplier.id, data);
      } else {
        await onSave(data);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to save supplier", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fornecedores</h2>
          <p className="text-muted-foreground">
            Gerencie sua lista de fornecedores e parceiros.
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
        </Button>
      </div>

      <SupplierList
        suppliers={suppliers}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do fornecedor abaixo.
            </DialogDescription>
          </DialogHeader>
          <SupplierForm
            initialData={editingSupplier}
            onSubmit={handleSubmit}
            isLoading={isSaving}
            onCancel={() => setIsModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}