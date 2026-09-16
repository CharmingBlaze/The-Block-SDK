import { IndexUnion } from "./weld-union";

export interface UvGridWeld {
  readonly kind: "uv-grid";
  readonly columns: number;
  readonly rows: number;
  readonly wrapU: boolean;
  readonly wrapV: boolean;
  readonly collapsePoles: boolean;
}

export function unionUvGrid(unions: IndexUnion, grid: UvGridWeld): void {
  const { columns, rows } = grid;
  if (columns < 2 || rows < 1 || columns * rows > unions.size) {
    return;
  }
  const at = (row: number, col: number): number => row * columns + col;
  if (grid.wrapU) {
    for (let row = 0; row < rows; row++) {
      unions.union(at(row, 0), at(row, columns - 1));
    }
  }
  if (grid.wrapV) {
    for (let col = 0; col < columns; col++) {
      unions.union(at(0, col), at(rows - 1, col));
    }
  }
  if (grid.collapsePoles) {
    for (let col = 1; col < columns; col++) {
      unions.union(at(0, 0), at(0, col));
      unions.union(at(rows - 1, 0), at(rows - 1, col));
    }
  }
}
