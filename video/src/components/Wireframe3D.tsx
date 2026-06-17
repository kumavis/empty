import React from 'react';
import { useClock } from './anim';

// A slowly spinning wireframe polyhedron, rendered as projected SVG edges.
// Used to give each LavaMoat product its own simple 3D signature.

type V3 = [number, number, number];
type Edge = [number, number];
type Mesh = { verts: V3[]; edges: Edge[] };

export type Shape = 'tetra' | 'cube' | 'sphere';

const tetra = (): Mesh => ({
  // regular tetrahedron
  verts: [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ],
  edges: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ],
});

const cube = (): Mesh => {
  const verts: V3[] = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1]) for (const z of [-1, 1]) verts.push([x, y, z]);
  const edges: Edge[] = [];
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++) {
      // connect vertices that differ in exactly one coordinate
      const d =
        Number(verts[i][0] !== verts[j][0]) +
        Number(verts[i][1] !== verts[j][1]) +
        Number(verts[i][2] !== verts[j][2]);
      if (d === 1) edges.push([i, j]);
    }
  return { verts, edges };
};

// UV sphere: latitude rings + longitude meridians (reads as a globe)
const sphere = (lat = 5, lon = 9): Mesh => {
  const verts: V3[] = [];
  const idx: number[][] = [];
  for (let i = 0; i <= lat; i++) {
    const theta = (i / lat) * Math.PI; // 0..pi
    const row: number[] = [];
    for (let j = 0; j < lon; j++) {
      const phi = (j / lon) * Math.PI * 2;
      verts.push([
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi),
      ]);
      row.push(verts.length - 1);
    }
    idx.push(row);
  }
  const edges: Edge[] = [];
  for (let i = 0; i <= lat; i++)
    for (let j = 0; j < lon; j++) {
      // ring edge (skip degenerate poles)
      if (i !== 0 && i !== lat)
        edges.push([idx[i][j], idx[i][(j + 1) % lon]]);
      // meridian edge
      if (i < lat) edges.push([idx[i][j], idx[i + 1][j]]);
    }
  return { verts, edges };
};

const MESHES: Record<Shape, Mesh> = {
  tetra: tetra(),
  cube: cube(),
  sphere: sphere(),
};

const rotate = (v: V3, rx: number, ry: number): V3 => {
  let [x, y, z] = v;
  // yaw (around Y)
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  // pitch (around X)
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  return [x, y, z];
};

export const Wireframe3D: React.FC<{
  shape: Shape;
  size?: number;
  color?: string;
  speed?: number; // radians / second (slow by default)
  reveal?: number; // 0..1 scale-in for entrance
  vertices?: boolean;
}> = ({
  shape,
  size = 200,
  color = '#8fe0f8',
  speed = 0.55,
  reveal = 1,
  vertices = true,
}) => {
  const { sec } = useClock();
  const mesh = MESHES[shape];
  const ry = sec * speed;
  const rx = 0.45 + Math.sin(sec * speed * 0.5) * 0.18; // gentle tilt wobble
  const focal = 5;
  const radius = (size / 2) * 0.82 * reveal;

  const pts = mesh.verts.map((v) => {
    const [x, y, z] = rotate(v, rx, ry);
    const persp = focal / (focal - z);
    return { x: x * persp * radius, y: y * persp * radius, z };
  });

  const half = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-half} ${-half} ${size} ${size}`}
      style={{ overflow: 'visible' }}
    >
      {mesh.edges.map(([a, b], i) => {
        const za = (pts[a].z + pts[b].z) / 2; // -1 (back) .. 1 (front)
        const t = (za + 1) / 2;
        return (
          <line
            key={i}
            x1={pts[a].x}
            y1={pts[a].y}
            x2={pts[b].x}
            y2={pts[b].y}
            stroke={color}
            strokeWidth={1.2 + 1.4 * t}
            strokeLinecap="round"
            opacity={(0.25 + 0.6 * t) * reveal}
          />
        );
      })}
      {vertices
        ? pts.map((p, i) => {
            const t = (p.z + 1) / 2;
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={(1.5 + 2.5 * t) * reveal}
                fill={color}
                opacity={(0.4 + 0.6 * t) * reveal}
              />
            );
          })
        : null}
    </svg>
  );
};
