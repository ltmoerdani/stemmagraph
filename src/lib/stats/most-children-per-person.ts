export interface ParentChildInput {
  childId: string;
  parentIds: string[];
}

export interface MostChildrenEntry {
  parentId: string;
  childCount: number;
}

export function mostChildrenPerPerson(
  rows: ParentChildInput[],
  topN = 10,
): MostChildrenEntry[] {
  if (topN <= 0) {
    return [];
  }

  const childrenByParent = new Map<string, Set<string>>();

  for (const row of rows) {
    for (const parentId of row.parentIds) {
      let children = childrenByParent.get(parentId);
      if (!children) {
        children = new Set<string>();
        childrenByParent.set(parentId, children);
      }
      children.add(row.childId);
    }
  }

  const entries: MostChildrenEntry[] = [];
  for (const [parentId, children] of childrenByParent) {
    if (children.size > 0) {
      entries.push({ parentId, childCount: children.size });
    }
  }

  entries.sort((a, b) => {
    if (b.childCount !== a.childCount) {
      return b.childCount - a.childCount;
    }
    return a.parentId < b.parentId ? -1 : a.parentId > b.parentId ? 1 : 0;
  });

  return entries.slice(0, topN);
}
