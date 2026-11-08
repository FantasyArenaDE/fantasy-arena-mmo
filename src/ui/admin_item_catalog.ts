import type { ItemDef } from '../sim/types';

const RESULT_LIMIT = 40;

function searchText(value: string): string {
  return value.toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
}

export function searchAdminItems(
  items: Readonly<Record<string, ItemDef>>,
  query: string,
  nameOf: (item: ItemDef) => string,
): { items: { id: string; name: string }[]; total: number } {
  const terms = searchText(query.trim()).split(/\s+/).filter(Boolean);
  const matches = Object.values(items).map(item => ({ id: item.id, name: nameOf(item) }))
    .filter(item => {
      const text = searchText(item.id + ' ' + item.name);
      return terms.every(term => text.includes(term));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de-DE') || a.id.localeCompare(b.id));
  return { items: matches.slice(0, RESULT_LIMIT), total: matches.length };
}
