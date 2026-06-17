import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';
import { fadeAt, springAt, useClock } from '../components/anim';
import { Embers } from '../components/Effects';
import { LavaTitle } from '../components/LavaTitle';
import { SceneShell } from '../components/SceneShell';
import { colors, fonts } from '../theme';

export const Title: React.FC = () => {
  const { frame, fps, sec } = useClock();
  const logoIn = springAt(frame, fps, 0.1, { damping: 16 });
  const float = Math.sin(sec * 1.4) * 8;
  return (
    <SceneShell id="title">
      <Embers count={16} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Img
          src={staticFile('assets/lavamoat-logo-new.svg')}
          style={{
            height: 480,
            transform: `scale(${logoIn}) translateY(${float}px)`,
          }}
        />
        <div style={{ opacity: fadeAt(frame, fps, 0.6, 0.6), marginTop: -30 }}>
          <LavaTitle width={1050} />
        </div>
        <div
          style={{
            opacity: fadeAt(frame, fps, 1.2, 0.6),
            transform: `translateY(${interpolate(
              fadeAt(frame, fps, 1.2, 0.6),
              [0, 1],
              [20, 0],
            )}px)`,
            color: colors.cyan,
            fontFamily: fonts.heading,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: 10,
          }}
        >
          javascript supplychain security
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
