import { useState, useEffect, useMemo } from 'react';

/**
 * Paginação client-side para listas já carregadas na memória.
 * @param resetKey — quando mudar, volta para a página 1 (ex.: filtros ou novo fetch).
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey: string) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const effectivePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const start = (effectivePage - 1) * pageSize;
  const paginatedItems = useMemo(
    () => items.slice(start, start + pageSize),
    [items, start, pageSize]
  );

  return {
    page: effectivePage,
    setPage,
    totalPages,
    paginatedItems,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    pageSize
  };
}
