import React from 'react';
import { AbsoluteFill } from 'remotion';
import { springAt, useClock } from '../components/anim';
import { SceneShell } from '../components/SceneShell';
import { Wireframe3D, type Shape } from '../components/Wireframe3D';
import { colors, fonts } from '../theme';
import timing from '../timing.json';
import { SceneHeading } from './Pipeline';

// Product reveals are driven by the narration's per-sentence marks:
// 1 "Allow-scripts blocks surprise install scripts."
// 2 "LavaMoat Node shields your build."
// 3 "...bundler plugins for webpack and browserify lock down your runtime."
const M = (timing.toolkit.marks as number[]).map((m) => m + timing.toolkit.lead);

type Product = {
  shape: Shape;
  stage: string;
  name: string;
  desc: string;
  at: number;
};

const PRODUCTS: Product[] = [
  { shape: 'tetra', stage: 'install', name: '@lavamoat/allow-scripts', desc: 'block surprise install scripts', at: M[1] },
  { shape: 'cube', stage: 'build', name: 'lavamoat-node', desc: 'sandbox your build & server', at: M[2] },
  { shape: 'sphere', stage: 'runtime', name: '@lavamoat/webpack', desc: 'lock down the shipped bundle', at: M[3] },
];

const Card: React.FC<{ p: Product; frame: number; fps: number }> = ({
  p,
  frame,
  fps,
}) => {
  const s = springAt(frame, fps, p.at, { damping: 16 });
  const active = s > 0.5;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 420,
        opacity: s,
        transform: `translateY(${(1 - s) * 40}px)`,
      }}
    >
      <div
        style={{
          width: 300,
          height: 300,
          borderRadius: 18,
          background: colors.panel,
          border: `2px solid ${active ? colors.green : colors.panelBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Wireframe3D
          shape={p.shape}
          size={230}
          color={active ? colors.green : colors.cyan}
          reveal={s}
        />
      </div>
      <div
        style={{
          marginTop: 28,
          fontFamily: fonts.heading,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 5,
          textTransform: 'uppercase',
          color: colors.dim,
        }}
      >
        {p.stage}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: fonts.mono,
          fontSize: 26,
          fontWeight: 700,
          color: colors.gray,
          textAlign: 'center',
        }}
      >
        {p.name}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: fonts.heading,
          fontSize: 22,
          fontWeight: 500,
          color: colors.dim,
          textAlign: 'center',
        }}
      >
        {p.desc}
      </div>
    </div>
  );
};

export const Toolkit: React.FC = () => {
  const { frame, fps } = useClock();
  return (
    <SceneShell id="toolkit">
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 70 }}>
        <SceneHeading frame={frame} fps={fps}>
          adopt it <span style={{ color: colors.green }}>one step at a time</span>
        </SceneHeading>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 30 }}>
          {PRODUCTS.map((p) => (
            <Card key={p.name} p={p} frame={frame} fps={fps} />
          ))}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
