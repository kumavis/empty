import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fadeAt, springAt, useClock } from '../components/anim';
import { Code } from '../components/Code';
import { ImpactFlash } from '../components/Effects';
import { SceneShell } from '../components/SceneShell';
import { colors, fonts } from '../theme';
import { SceneHeading } from './Pipeline';

const POLICY_JSON = `
"browser-pack": {
  "globals": {
    "__dirname": true,
    "process.cwd": true
  },
  "builtin": {
    "fs.readFileSync": true,
    "path.join": true
  },
  "packages": {
    "JSONStream": true,
    "through2": true
  }
}
`;

const CLI = `
$ lavamoat app.js --writeAutoPolicy
  policy written to lavamoat/policy.json

$ lavamoat app.js   # enforced
`;

const COMPARTMENTS = [
  { label: 'my-app', at: 2.2 },
  { label: 'pkg: abc', at: 2.8 },
  { label: 'pkg: xyz', at: 3.4 },
];
const KERNEL_AT = 4.0;

export const Policy: React.FC = () => {
  const { frame, fps } = useClock();
  const kernelIn = springAt(frame, fps, KERNEL_AT, { damping: 16 });
  const cliIn = springAt(frame, fps, 13.0, { damping: 14 });
  return (
    <SceneShell id="policy" shakes={[{ at: KERNEL_AT, amp: 6 }]}>
      <ImpactFlash atSec={KERNEL_AT} color={colors.lavaBottom} peak={0.12} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 48 }}>
        <SceneHeading frame={frame} fps={fps}>
          LavaMoat wraps every package{' '}
          <span style={{ color: colors.lavaBottom }}>in its own compartment</span>
        </SceneHeading>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 80,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: 760 }}>
            <div style={{ display: 'flex', gap: 28, justifyContent: 'center' }}>
              {COMPARTMENTS.map((c) => {
                const s = springAt(frame, fps, c.at, { damping: 14 });
                return (
                  <div
                    key={c.label}
                    style={{
                      width: 220,
                      height: 230,
                      borderRadius: 14,
                      border: `2px solid ${colors.lavaBottom}`,
                      background: colors.panel,
                      transform: `scale(${s})`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingTop: 20,
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 26,
                        fontWeight: 700,
                        color: colors.cyan,
                      }}
                    >
                      {c.label}
                    </div>
                    {[120, 150, 90, 140].map((w, i) => (
                      <div
                        key={i}
                        style={{
                          width: w,
                          height: 12,
                          borderRadius: 6,
                          background: '#3d4148',
                          alignSelf: 'flex-start',
                          marginLeft: 30,
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            <svg width={760} height={70} style={{ display: 'block' }}>
              {COMPARTMENTS.map((c, i) => {
                const x = 380 + (i - 1) * 248;
                return (
                  <line
                    key={c.label}
                    x1={x}
                    y1={0}
                    x2={380 + (i - 1) * 120}
                    y2={70}
                    stroke={colors.lavaBottom}
                    strokeWidth={3}
                    strokeDasharray="8 7"
                    opacity={kernelIn * 0.8}
                  />
                );
              })}
            </svg>
            <div
              style={{
                height: 96,
                borderRadius: 14,
                background: colors.panel,
                border: `2px solid ${colors.lavaBottom}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: fonts.heading,
                fontWeight: 800,
                fontSize: 38,
                color: colors.lavaBottom,
                transform: `scaleX(${kernelIn})`,
              }}
            >
              LavaMoat kernel
            </div>
            <div
              style={{
                marginTop: 36,
                opacity: cliIn,
                transform: `translateY(${(1 - cliIn) * 30}px)`,
              }}
            >
              <Code
                code={CLI}
                title="policy is generated automatically"
                fontSize={27}
                typeStartSec={13.3}
                typeDurSec={2.2}
                accent={colors.green}
              />
            </div>
          </div>
          <div style={{ opacity: fadeAt(frame, fps, 5.2, 0.5), width: 720 }}>
            <Code
              code={POLICY_JSON}
              title="lavamoat/policy.json — per-package permissions"
              fontSize={27}
              typeStartSec={5.4}
              typeDurSec={4.8}
            />
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
