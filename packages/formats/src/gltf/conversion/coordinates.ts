/** SDK and glTF 2.0 both use Y-up, right-handed. No axis conversion. */
export function passthroughPosition(x: number, y: number, z: number): [number, number, number] {
  return [x, y, z];
}
