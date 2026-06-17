import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fadeAt, springAt, useClock } from '../components/anim';
import { ImpactFlash } from '../components/Effects';
import { Icon } from '../components/Icon';
import { SceneShell } from '../components/SceneShell';
import { colors, fonts } from '../theme';
import timing from '../timing.json';
import { Pipeline, SceneHeading } from './Pipeline';

// horizontal offsets of the three stage boxes within the pipeline layout
const STAGE_X = [-442, 0, 442];

// Beats from the narration marks:
// 0 "There's someone in your codebase, and you can't trust them."
// 1 "A malicious package can strike anywhere in your pipeline."
// 2 install · 3 build · 4 runtime
const M = (timing.stages.marks as number[]).map((m) => m + timing.stages.lead);
const HOOK_AT = M[0];
const HEAD_AT = M[1];
const BEATS = [M[2], M[3], M[4]];

export const Stages: React.FC = () => {
  const { frame, fps } = useClock();
  const move1 = springAt(frame, fps, BEATS[1], { damping: 16 });
  const move2 = springAt(frame, fps, BEATS[2], { damping: 16 });
  const evilIn = springAt(frame, fps, BEATS[0], { damping: 12 });
  const evilX =
    STAGE_X[0] +
    (STAGE_X[1] - STAGE_X[0]) * move1 +
    (STAGE_X[2] - STAGE_X[1]) * move2;
  const hop = Math.abs(Math.sin((move1 + move2) * Math.PI)) * -60;
  return (
    <SceneShell id="stages" shakes={BEATS.map((at) => ({ at, amp: 7 }))}>
      {BEATS.map((at) => (
        <ImpactFlash key={at} atSec={at} peak={0.1} />
      ))}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 60 }}>
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 40,
            fontWeight: 600,
            color: colors.red,
            opacity: fadeAt(frame, fps, HOOK_AT, 0.5) * (1 - fadeAt(frame, fps, HEAD_AT, 0.5) * 0.45),
          }}
        >
          there&rsquo;s someone in your codebase — and you can&rsquo;t trust them
        </div>
        <SceneHeading frame={frame} fps={fps} at={HEAD_AT}>
          a malicious dependency can strike{' '}
          <span style={{ color: colors.red }}>at every stage</span>
        </SceneHeading>
        <div style={{ position: 'relative' }}>
          <Pipeline
            frame={frame}
            fps={fps}
            accent={colors.red}
            appearAt={HEAD_AT + 0.2}
            stages={[
              {
                icon: 'tree',
                label: 'install',
                activeAt: BEATS[0],
                sub: 'lifecycle scripts',
                subColor: colors.red,
              },
              {
                icon: 'cogs',
                label: 'build',
                activeAt: BEATS[1],
                sub: 'compromised tooling',
                subColor: colors.red,
              },
              {
                icon: 'users',
                label: 'runtime',
                activeAt: BEATS[2],
                sub: 'code your users run',
                subColor: colors.red,
              },
            ]}
          />
          <div
            style={{
              position: 'absolute',
              top: -150,
              left: '50%',
              transform: `translateX(${evilX - 60}px) translateY(${hop}px) scale(${evilIn})`,
              opacity: evilIn,
              filter: `drop-shadow(0 0 ${18 + 10 * Math.sin(frame / 4)}px ${colors.red})`,
            }}
          >
            <Icon name="evil" size={120} color={colors.red} />
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
