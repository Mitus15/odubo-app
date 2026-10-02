# Recoolman's skeleton is 0.86 m to the side of his body

**Found 2026-09-29** while posing him for the flight game (`/fly`).

## Symptom

Rotating `UpperArmL` 90° about the model's z axis in three.js sent the hand from
`(0.606, 0.923)` to `(0.751, 2.506)`: up and away, not out to the side. Rotating about x
behaved, which is what made it look like an axis problem at first. It is not.

## Cause

`public/models/avatar-male.glb` (and very likely `avatar-female.glb`, same export):

| | x centre (world) |
|---|---|
| Rendered mesh at rest | 0.800 |
| Bones (average) | 1.664 |

The armature node carries `translation [1.664, 0, 0]`, scale 1.08. The inverse bind
matrices cancel the armature exactly, so at rest the skin renders at its raw vertex
positions (x ≈ 0.8) while the joints sit at x ≈ 1.664. Every vertex is bound 0.864 m to the
side of the joint that drives it. Rest pose looks perfect; any bone rotation swings the
limb about a point in empty air. The Blender export almost certainly had the armature
object offset from the body.

Nothing noticed until now because nothing had posed a bone: the street runner and the
About/Showcase viewer move the whole avatar rigidly.

## Fix (runtime, no asset change)

`src/components/fly/scene/rig.ts`, `createRig()`:

1. Clone with `SkeletonUtils.clone` (the `useGLTF` cache is shared site-wide).
2. Measure the rendered rest box (`Box3.setFromObject(root, true)`, skinning included) and
   the bones' average position. The offset is the difference in x and z.
3. Move the root bones (those whose parent is not a bone) by the offset, update matrices,
   `skeleton.calculateInverses()`. The bind matrix stays identity, so the rest render is
   unchanged and every joint now turns where the body bends.

Verified in Node with three's `GLTFLoader`: after the fix, the same rotation takes the hand
to `(-0.113, 1.642)`, straight out from the shoulder.

## If the asset is ever re-exported

Apply the armature's transform in Blender (or parent the mesh to it with the offset baked)
before exporting. `createRig` skips the correction when the offset is under a millimetre,
so a fixed file needs no code change.
