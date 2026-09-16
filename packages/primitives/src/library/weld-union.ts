export class IndexUnion {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(count: number) {
    this.parent = Array.from({ length: count }, (_, i) => i);
    this.rank = Array.from({ length: count }, () => 0);
  }

  get size(): number {
    return this.parent.length;
  }

  find(index: number): number {
    let root = index;
    while (this.parent[root] !== root) {
      root = this.parent[root]!;
    }
    let cursor = index;
    while (cursor !== root) {
      const next = this.parent[cursor]!;
      this.parent[cursor] = root;
      cursor = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) {
      return;
    }
    const rankA = this.rank[ra]!;
    const rankB = this.rank[rb]!;
    if (rankA < rankB) {
      this.parent[ra] = rb;
      return;
    }
    this.parent[rb] = ra;
    if (rankA === rankB) {
      this.rank[ra] = rankA + 1;
    }
  }
}
