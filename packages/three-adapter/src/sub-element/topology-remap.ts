export interface IdRemapTable {
  readonly deleted: ReadonlySet<string>;
  readonly replacedBy: ReadonlyMap<string, readonly string[]>;
}

export function remapStableId(id: string, mapping: IdRemapTable): string | null {
  if (mapping.deleted.has(id) && !mapping.replacedBy.has(id)) {
    return null;
  }
  const replaced = mapping.replacedBy.get(id);
  if (replaced && replaced[0]) {
    return replaced[0];
  }
  return id;
}

export function remapIdList(ids: readonly string[], mapping: IdRemapTable): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const mapped = remapStableId(id, mapping);
    if (!mapped || seen.has(mapped)) {
      continue;
    }
    seen.add(mapped);
    next.push(mapped);
  }
  return next;
}

export function remapHover(hoverId: string | null, mapping: IdRemapTable): string | null {
  if (!hoverId) {
    return null;
  }
  return remapStableId(hoverId, mapping);
}
