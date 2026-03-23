import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

export function ListPaginationBar({
  page,
  totalPages,
  onPageChange,
  from,
  to,
  total,
  className
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  from: number;
  to: number;
  total: number;
  className?: string;
}) {
  if (total <= 0) return null;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-1 border-t text-sm text-muted-foreground',
        className
      )}
    >
      <span>
        Mostrando <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> de{' '}
        <span className="font-medium text-foreground">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[120px] text-center tabular-nums text-foreground">
          Página {page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
