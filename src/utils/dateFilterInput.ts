import type React from 'react';

/** Props comuns para input type="date" em filtros (não dispara ao digitar/selecionar até aplicar). */
export function dateFilterKeyHandlers(onApply: () => void) {
  return {
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onApply();
      }
    }
  };
}
