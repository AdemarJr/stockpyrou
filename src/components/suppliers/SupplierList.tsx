import { useMemo, useState } from "react";
import { Supplier } from "../../types";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Search } from "lucide-react";
import { rowMatchesSearch } from "../../utils/listFilters";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchesText = rowMatchesSearch(searchQuery, [
        s.name,
        s.contact,
        s.email,
        s.phone,
      ]);
      const matchesRating =
        ratingFilter === "all" || String(s.rating) === ratingFilter;
      return matchesText && matchesRating;
    });
  }, [suppliers, searchQuery, ratingFilter]);

  const resetKey = `${suppliers.map((s) => s.id).join(",")}|${searchQuery}|${ratingFilter}`;
  const { paginatedItems, page, setPage, totalPages, from, to, total } = usePagination(
    filteredSuppliers,
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
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/20 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs text-muted-foreground">Buscar cadastro</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Nome, contato, e-mail ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Avaliação</Label>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as notas</SelectItem>
              {[5, 4, 3, 2, 1].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} estrela{n === 1 ? "" : "s"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredSuppliers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          Nenhum fornecedor corresponde aos filtros. Ajuste a busca ou a avaliação.
        </div>
      ) : (
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
      )}
    </div>
  );
}