import { useMemo } from "react";
import { Supplier } from "../../types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { ListPaginationBar } from "../ui/list-pagination-bar";
import { usePagination } from "../../hooks/usePagination";
import { Edit, Loader2, Trash2 } from "lucide-react";

interface SupplierListProps {
  suppliers: Supplier[];
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: string) => void;
  deletingId?: string | null;
}

export function SupplierList({ suppliers, onEdit, onDelete, deletingId }: SupplierListProps) {
  const resetKey = useMemo(() => suppliers.map((s) => s.id).join(","), [suppliers]);
  const { paginatedItems, page, setPage, totalPages, from, to, total } = usePagination(
    suppliers,
    10,
    resetKey
  );

  if (suppliers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhum fornecedor cadastrado.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead className="text-center">Avaliação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedItems.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-medium">{supplier.name}</TableCell>
              <TableCell>{supplier.contact}</TableCell>
              <TableCell>{supplier.email || "-"}</TableCell>
              <TableCell>{supplier.phone || "-"}</TableCell>
              <TableCell className="text-center">
                {supplier.rating}/5
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(supplier)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    disabled={deletingId === supplier.id}
                    onClick={() => onDelete(supplier.id)}
                  >
                    {deletingId === supplier.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ListPaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        from={from}
        to={to}
        total={total}
      />
    </div>
  );
}