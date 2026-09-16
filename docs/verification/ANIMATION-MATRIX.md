# Animation verification matrix

| Case | Package | Assertion |
| --- | --- | --- |
| Linear position | animation | Midpoint interpolates |
| Quaternion slerp | animation | Result is unit length |
| Constant / STEP | animation | Holds previous key |
| Cubic scalars | animation | Catmull-Rom, not CUBICSPLINE |
| Visibility | animation | Threshold 0.5 |
| Exact component count | animation | Extra/missing components throw |
| Duplicate target/channel | animation | Rejected |
| Unsorted / duplicate times | animation | Rejected |
| Loop once / repeat / ping-pong | animation | `wrapTime` |
| Bone vs object targets | animation | Separate pose maps |
| Legacy glTF tracks | animation | Compatibility conversion only |
| CUBICSPLINE at legacy boundary | animation | Throws; not treated as LINEAR |
| Three.js clip + mixer | three-adapter | Multiple clips, switch, loop, dispose |
| glTF STEP / LINEAR | formats | Round-trip interpolation names |
| glTF CUBICSPLINE strict | formats | Loss + empty tracks |
| glTF CUBICSPLINE repair | formats | Approximated LINEAR keys + loss |
| Visibility export | formats | Omitted with structured loss |
