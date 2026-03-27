import { cn } from '../components/ui/utils';

/** Borda/anel vermelho para inputs nativos (fora do componente Input do shadcn). */
export function nativeFieldInvalidClass(invalid: boolean): string {
  return cn(
    invalid &&
      'border-destructive ring-2 ring-destructive/20 dark:ring-destructive/40 aria-invalid:border-destructive'
  );
}

/** shadcn Input, Textarea e SelectTrigger já estilizam com aria-invalid. */
export function ariaInvalidProps(invalid: boolean): { 'aria-invalid'?: boolean } {
  return invalid ? { 'aria-invalid': true } : {};
}
