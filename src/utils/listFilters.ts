/** Busca textual insensível a maiúsculas; string vazia = aceita tudo. */
export function textMatchesQuery(text: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return String(text ?? '')
    .toLowerCase()
    .includes(q);
}

/** Vários campos: basta um coincidir com a busca. */
export function rowMatchesSearch(
  query: string,
  fields: Array<string | null | undefined>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(f ?? '').toLowerCase().includes(q));
}
