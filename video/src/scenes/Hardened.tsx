import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { fadeAt, springAt, useClock } from '../components/anim';
import { Code } from '../components/Code';
import { LavaTitle } from '../components/LavaTitle';
import { SceneShell } from '../components/SceneShell';
import { colors, fonts } from '../theme';
import timing from '../timing.json';

const LOCKDOWN = `
// SES provides
lockdown()

// primordials are now frozen
Object.freeze(Object.prototype)
Object.freeze(Array.prototype)
// ...etc

// tampering fails loudly
Array.prototype.map = evil
// TypeError: read-only property
`;

const COMPARTMENT = `
// each package gets its own globals
const c = new Compartment({
  // only explicit endowments
  fetch: limitedFetch,
})
c.evaluate(packageCode)

// no process, no document --
// nothing you didn't grant
`;

// Beats from the narration marks:
// 0 "Enter LavaMoat."  1 "It's built on Hardened JavaScript."
// 2 lockdown  3 Compartment  4 "...explicitly hand it."
// 5 "The goal isn't just isolation."  6 "It's fearless cooperation..."
const M = (timing.hardened.marks as number[]).map((m) => m + timing.hardened.lead);

const Column: React.FC<{
  at: number;
  label: string;
  frame: number;
  fps: number;
  children: React.ReactNode;
}> = ({ at, label, frame, fps, children }) => {
  const s = springAt(frame, fps, at, { damping: 17 });
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        opacity: s,
        transform: `translateY(${(1 - s) * 50}px)`,
      }}
    >
      <div
        style={{
          fontFamily: fonts.heading,
          fontSize: 34,
          fontWeight: 700,
          color: colors.cyan,
          textAlign: 'center',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
};

export const Hardened: React.FC = () => {
  const { frame, fps, sec } = useClock();
  const logoIn = springAt(frame, fps, M[0] + 0.1, { damping: 15 });
  const coop = springAt(frame, fps, M[5], { damping: 16 });
  return (
    <SceneShell id="hardened">
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 34 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 26,
            transform: `scale(${logoIn})`,
            opacity: logoIn,
          }}
        >
          <Img
            src={staticFile('assets/lavamoat-logo-new.svg')}
            style={{ height: 150, transform: `translateY(${Math.sin(sec * 1.4) * 4}px)` }}
          />
          <LavaTitle width={420} />
        </div>
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 36,
            fontWeight: 700,
            color: colors.gray,
            opacity: fadeAt(frame, fps, M[1], 0.5),
          }}
        >
          built on <span style={{ color: colors.cyan }}>Hardened JavaScript</span>{' '}
          <span style={{ color: colors.dim, fontWeight: 600 }}>(SES, by Agoric)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 60 }}>
          <Column at={M[2]} label="lockdown() — freeze the foundations" frame={frame} fps={fps}>
            <Code
              code={LOCKDOWN}
              fontSize={26}
              typeStartSec={M[2] + 0.3}
              typeDurSec={3.2}
              width={760}
              accent={colors.cyan}
            />
          </Column>
          <Column at={M[3]} label="Compartment — isolate each package" frame={frame} fps={fps}>
            <Code
              code={COMPARTMENT}
              fontSize={26}
              typeStartSec={M[3] + 0.3}
              typeDurSec={3.2}
              width={760}
              accent={colors.cyan}
            />
          </Column>
        </div>
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 36,
            fontWeight: 700,
            color: colors.gray,
            opacity: coop,
            transform: `translateY(${(1 - coop) * 24}px)`,
          }}
        >
          not just isolation — <span style={{ color: colors.green }}>fearless cooperation</span>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
