#!/usr/bin/env node
/**
 * Optimize a GLB for MoneyBot mobile:
 * - Strip unused skinning when there are no animations
 * - Weld + meshopt-simplify + prune + dedup
 *
 * Usage: node optimize.mjs <in.glb> <out.glb> [ratio]
 * Prints one JSON line to stdout with optimization stats.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, dequantize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs';

const [, , inPath, outPath, ratioArg] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node optimize.mjs <in.glb> <out.glb> [ratio]');
  process.exit(2);
}

const ratio = ratioArg ? parseFloat(ratioArg) : 0.35;
if (!(ratio > 0 && ratio <= 1)) {
  console.error('ratio must be between 0 and 1');
  process.exit(2);
}

function meshStats(root) {
  let tris = 0;
  let verts = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) verts += pos.getCount();
      const idx = prim.getIndices();
      tris += idx ? idx.getCount() / 3 : (pos ? pos.getCount() / 3 : 0);
    }
  }
  return { verts: Math.round(verts), tris: Math.round(tris) };
}

const bytesBefore = fs.statSync(inPath).size;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inPath);
const root = doc.getRoot();
const before = meshStats(root);
const hasAnim = root.listAnimations().length > 0;

let strippedSkin = false;
if (!hasAnim) {
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const sem of ['JOINTS_0', 'WEIGHTS_0', 'JOINTS_1', 'WEIGHTS_1']) {
        if (prim.getAttribute(sem)) {
          prim.setAttribute(sem, null);
          strippedSkin = true;
        }
      }
    }
  }
  for (const node of root.listNodes()) {
    if (node.getSkin()) node.setSkin(null);
  }
  for (const skin of root.listSkins()) skin.dispose();
}

await doc.transform(
  dequantize(),
  weld({ tolerance: 0.0001 }),
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }),
  prune(),
  dedup(),
);

await io.write(outPath, doc);
const after = meshStats(doc.getRoot());
const bytesAfter = fs.statSync(outPath).size;

console.log(JSON.stringify({
  strippedSkin,
  hasAnim,
  ratio,
  bytesBefore,
  bytesAfter,
  vertsBefore: before.verts,
  vertsAfter: after.verts,
  trisBefore: before.tris,
  trisAfter: after.tris,
}));
