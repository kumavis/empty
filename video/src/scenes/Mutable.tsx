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

// Beats from timing.json marks (+0.5s lead), see scripts/build-narration.py
const FLEX_AT = 3.7; // "In a word: flexibility."
const THESIS_AT = 5.7; // "...makes JavaScript vulnerable ... let us make it safe."
const HEADING_AT = 14.8; // "Reason one: everything is mutable."
const ATTACK_AT = 17.1; // "Any package can overwrite Array prototype map..."
const IMPACT_AT = 20.5; // "...instantly, the entire app is compromised."

export const Mutable: React.FC = () => {
  const { frame, fps } = useClock();
  const flexIn = springAt(frame, fps, FLEX_AT, { damping: 14 });
  const thesisIn = springAt(frame, fps, THESIS_AT, { damping: 16 });
  const impactIn = springAt(frame, fps, IMPACT_AT, { damping: 12 });
  // question + thesis sit centered until the "#1" reveal pushes them up
  const settle = springAt(frame, fps, HEADING_AT - 0.5, { damping: 18 });
  return (
    <SceneShell id="mutable" shakes={[{ at: IMPACT_AT, amp: 13 }]}>
      <ImpactFlash atSec={IMPACT_AT} peak={0.22} />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          transform: `translateY(${(1 - settle) * 260}px)`,
        }}
      >
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              fontFamily: fonts.heading,
              fontSize: 58,
              fontWeight: 800,
              color: colors.gray,
              opacity: flexIn,
              transform: `translateY(${(1 - flexIn) * 30}px)`,
            }}
          >
            flexibility
          </div>
          <div
            style={{
              fontFamily: fonts.heading,
              fontSize: 38,
              fontWeight: 600,
              color: colors.dim,
              textAlign: 'center',
              opacity: thesisIn,
              transform: `translateY(${(1 - thesisIn) * 30}px)`,
            }}
          >
            makes it <span style={{ color: colors.red, fontWeight: 800 }}>vulnerable</span> — and
            lets us make it <span style={{ color: colors.cyan, fontWeight: 800 }}>safe</span>
          </div>
        </div>
        <SceneHeading frame={frame} fps={fps} color={colors.red} at={HEADING_AT}>
          #1 — everything is mutable
        </SceneHeading>
        <div style={{ opacity: fadeAt(frame, fps, ATTACK_AT - 0.2, 0.4) }}>
          <Code code={ATTACK} fontSize={36} typeStartSec={ATTACK_AT} typeDurSec={2.0} width={1240} />
        </div>
        <div
          style={{
            opacity: impactIn,
            transform: `translateY(${(1 - impactIn) * 40}px)`,
          }}
        >
          <Code
            code={IMPACT}
            fontSize={36}
            typeStartSec={IMPACT_AT + 0.2}
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
