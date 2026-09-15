# Images and paint

Canonical pixels live on `ModelDocument.images` (sparse 64×64 tiles) and runtime `TextureBuffer` maps in `ModelingSession.textures`. Hosts never store GPU objects in `@modeling-kit/paint`.

## Image documents

`createImageDocument` starts with one raster layer. Empty tiles are omitted after writes so a large canvas does not allocate a full buffer.

```ts
session.execute(new CreateImageDocumentCommand({ width: 1024, height: 1024 }));
session.execute(new AddImageLayerCommand({ imageDocumentId, name: "Paint" }));
session.execute(new ApplyImageTilePatchesCommand({ imageDocumentId, patches }));
```

Layer add/remove/update and tile patches are commands with exact undo. Groups composite children in stack order. Blend modes on the document are `normal`, `multiply`, `add`, and `screen`.

## 2D strokes

`PaintEngine` uses `OperationLifecycleMachine` (`idle → beginning → active → committing → completed`, then `recycle()`). Preview captures **only dirty 64×64 tiles**, not the whole texture.

```ts
session.beginPaintStroke(textureId);
session.dabPaintStroke(x, y, { size: 4, color: [255, 0, 0, 255] });
session.commitPaintStroke(); // one PaintStrokeCommand, or false if unchanged
session.cancelPaintStroke(); // restore tiles; zero history
```

Do not mutate `session.textures` pixels during a stroke; the engine never sees those writes and cannot snapshot or undo them.

`dispose()` on the engine or session cancels an open stroke and drops tile snapshots.

## 3D hits

The host supplies `SurfaceHit` `{ faceId, u, v }` (barycentric). `paintSurfaceHit` / `paintSurfaceHitOnStroke` map through `interpolateFaceUv` → `uvToPixel`. No Three.js types in the paint package.

After each 3D dab, opaque texels dilate into transparent neighbors (`seamDilation`, default 2) so bilinear filtering does not sample empty gutter pixels across UV islands. Pass `seamDilation: 0` to skip. Dilation is recorded in the same stroke tile snapshots, so cancel restores the gutter.
