import type { WatlasAtlas, WatlasModule } from "./load";

export function withAtlas<T>(watlas: WatlasModule, run: (atlas: WatlasAtlas) => T): T {
  const atlas = new watlas.Atlas();
  try {
    return run(atlas);
  } finally {
    atlas.delete();
  }
}
