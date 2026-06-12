import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fadeAt, springAt, useClock } from '../components/anim';
import { Code } from '../components/Code';
import { SceneShell } from '../components/SceneShell';
import { colors, fonts } from '../theme';
import { SceneHeading } from './Pipeline';

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
        gap: 26,
        opacity: s,
        transform: `translateY(${(1 - s) * 50}px)`,
      }}
    >
      <div
        style={{
          fontFamily: fonts.heading,
          fontSize: 40,
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
  const { frame, fps } = useClock();
  return (
    <SceneShell id="hardened">
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 44 }}>
        <SceneHeading frame={frame} fps={fps} color={colors.gray}>
          the foundation:{' '}
          <span style={{ color: colors.cyan }}>Hardened JavaScript</span>{' '}
          <span style={{ color: colors.dim, fontWeight: 600 }}>(SES, by Agoric)</span>
        </SceneHeading>
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 38,
            fontWeight: 600,
            color: colors.dim,
            opacity: fadeAt(frame, fps, 2.1, 0.5),
          }}
        >
          that same <span style={{ color: colors.cyan, fontWeight: 800 }}>flexibility</span>,
          turned into defense
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 70 }}>
          <Column at={7.3} label="lockdown() — freeze the foundations" frame={frame} fps={fps}>
            <Code
              code={LOCKDOWN}
              fontSize={27}
              typeStartSec={7.6}
              typeDurSec={3.2}
              width={780}
              accent={colors.cyan}
            />
          </Column>
          <Column at={11.9} label="Compartment — isolate each package" frame={frame} fps={fps}>
            <Code
              code={COMPARTMENT}
              fontSize={27}
              typeStartSec={12.2}
              typeDurSec={3.2}
              width={780}
              accent={colors.cyan}
            />
          </Column>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
