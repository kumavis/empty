import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fadeAt, springAt, useClock } from '../components/anim';
import { Code } from '../components/Code';
import { ImpactFlash } from '../components/Effects';
import { SceneShell } from '../components/SceneShell';
import { colors, fonts } from '../theme';
import { SceneHeading } from './Pipeline';

const ATTACK = `
// anyone can modify base functionality
Array.prototype.map = () => { /* ... */ }
`;

const IMPACT = `
// every package shares the same intrinsics
['user', 'data'].map(render)   // hijacked!
`;

const IMPACT_AT = 11.0;

export const Mutable: React.FC = () => {
  const { frame, fps } = useClock();
  const impactIn = springAt(frame, fps, IMPACT_AT, { damping: 12 });
  return (
    <SceneShell id="mutable" shakes={[{ at: IMPACT_AT, amp: 13 }]}>
      <ImpactFlash atSec={IMPACT_AT} peak={0.22} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 56 }}>
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 46,
            fontWeight: 600,
            color: colors.dim,
            opacity: fadeAt(frame, fps, 0.3, 0.5),
          }}
        >
          why is JavaScript such an easy target?
        </div>
        <SceneHeading frame={frame} fps={fps} color={colors.red} at={3.95}>
          #1 — everything is mutable
        </SceneHeading>
        <div style={{ opacity: fadeAt(frame, fps, 6.4, 0.4) }}>
          <Code code={ATTACK} fontSize={40} typeStartSec={6.6} typeDurSec={2.0} width={1240} />
        </div>
        <div
          style={{
            opacity: impactIn,
            transform: `translateY(${(1 - impactIn) * 40}px)`,
          }}
        >
          <Code
            code={IMPACT}
            fontSize={40}
            typeStartSec={11.2}
            typeDurSec={1.4}
            width={1240}
            accent={colors.red}
            lineHighlights={{ 1: 'rgba(236,39,58,0.18)' }}
          />
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
