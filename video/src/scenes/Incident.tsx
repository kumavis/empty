import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { fadeAt, springAt, useClock } from '../components/anim';
import { ImpactFlash } from '../components/Effects';
import { SceneShell } from '../components/SceneShell';
import { colors, fonts } from '../theme';

// Real headlines from the 2018 event-stream / Copay incident
// (screenshots reused from the Devcon 6 talk repo)
const CARDS = [
  { src: 'assets/event-stream-article-2.png', rot: -5, x: -560, y: 30, w: 600, at: 3.0 },
  { src: 'assets/event-stream-article-0.png', rot: 3, x: -185, y: -30, w: 600, at: 4.2 },
  { src: 'assets/event-stream-article-1.png', rot: -2, x: 190, y: 40, w: 600, at: 5.4 },
  { src: 'assets/npm-event-stream.png', rot: 4, x: 545, y: -20, w: 600, at: 6.6 },
];
const BANNER_AT = 10.1;

export const Incident: React.FC = () => {
  const { frame, fps, sec } = useClock();
  return (
    <SceneShell id="incident" shakes={[{ at: BANNER_AT, amp: 11 }]}>
      <ImpactFlash atSec={BANNER_AT} peak={0.18} />
      <AbsoluteFill
        style={{
          alignItems: 'center',
        }}
      >
        <div
          style={{
            marginTop: 90,
            fontFamily: fonts.heading,
            fontSize: 64,
            fontWeight: 800,
            color: colors.gray,
            opacity: fadeAt(frame, fps, 0.3, 0.5),
          }}
        >
          2018 — the{' '}
          <span style={{ color: colors.red, fontFamily: fonts.mono }}>
            event-stream
          </span>{' '}
          incident
        </div>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 620,
            marginTop: 60,
          }}
        >
          {CARDS.map((c, ci) => {
            const s = springAt(frame, fps, c.at, { damping: 15 });
            const drift = Math.sin(sec * 0.9 + ci * 1.8) * 0.7;
            return (
              <div
                key={c.src}
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${c.x}px)`,
                  top: `calc(50% + ${c.y}px)`,
                  transform: `translate(-50%, -50%) rotate(${c.rot + drift}deg) scale(${s})`,
                  opacity: s,
                  borderRadius: 10,
                  overflow: 'hidden',
                  boxShadow: '0 30px 70px rgba(0,0,0,0.6)',
                  border: '1px solid #3a3d42',
                }}
              >
                <Img src={staticFile(c.src)} style={{ width: c.w, display: 'block' }} />
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 30,
            padding: '22px 48px',
            borderRadius: 14,
            background: colors.red,
            color: '#fff',
            fontFamily: fonts.heading,
            fontSize: 42,
            fontWeight: 700,
            opacity: fadeAt(frame, fps, BANNER_AT, 0.3),
            transform: `translateY(${(1 - springAt(frame, fps, BANNER_AT, { damping: 12 })) * 60}px)`,
          }}
        >
          shipped in official releases — stole users&apos; private keys
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
