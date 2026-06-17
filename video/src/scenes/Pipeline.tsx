import React from 'react';
import { fadeAt, springAt } from '../components/anim';
import { Icon } from '../components/Icon';
import { colors, fonts } from '../theme';

export type StageSpec = {
  icon: 'tree' | 'cogs' | 'users';
  label: string;
  // when this stage becomes "active" (highlighted), in scene seconds
  activeAt: number;
  sub?: string;
  subColor?: string;
};

// Shared install -> build -> runtime pipeline used by Stages and Toolkit.
export const Pipeline: React.FC<{
  frame: number;
  fps: number;
  stages: StageSpec[];
  appearAt?: number;
  accent: string; // highlight color for the active stage border
  activeHold?: boolean; // keep stages highlighted after activation
  badge?: (stage: StageSpec, active: number) => React.ReactNode;
}> = ({ frame, fps, stages, appearAt = 0.4, accent, activeHold = true, badge }) => {
  const sec = frame / fps;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 36,
        justifyContent: 'center',
      }}
    >
      {stages.map((stage, i) => {
        const inAnim = springAt(frame, fps, appearAt + i * 0.25, { damping: 15 });
        const activeAnim = springAt(frame, fps, stage.activeAt, { damping: 13 });
        const isPast = sec >= stage.activeAt;
        const active = activeHold
          ? activeAnim
          : isPast && (i === stages.length - 1 || sec < stages[i + 1].activeAt)
            ? activeAnim
            : 0;
        return (
          <React.Fragment key={stage.label}>
            {i > 0 ? (
              <div style={{ alignSelf: 'flex-start', paddingTop: 100, opacity: inAnim }}>
                <Icon name="arrow-right2" size={90} color="#5b626d" />
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 22,
              }}
            >
              <div
                style={{
                  width: 280,
                  height: 280,
                  borderRadius: 16,
                  background: colors.panel,
                  border: `2px solid ${active > 0.05 ? accent : colors.panelBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 24,
                  transform: `scale(${inAnim * (1 + 0.04 * active)})`,
                }}
              >
                <Icon name={stage.icon} size={120} color={colors.gray} />
                <div
                  style={{
                    fontFamily: fonts.heading,
                    fontWeight: 700,
                    fontSize: 40,
                    color: colors.cyan,
                  }}
                >
                  {stage.label}
                </div>
              </div>
              {stage.sub ? (
                <div
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 30,
                    fontWeight: 700,
                    color: stage.subColor ?? colors.gray,
                    background: colors.panel,
                    border: `2px solid ${stage.subColor ?? colors.panelBorder}`,
                    borderRadius: 12,
                    padding: '14px 22px',
                    opacity: active,
                    transform: `translateY(${(1 - active) * 26}px)`,
                  }}
                >
                  {stage.sub}
                </div>
              ) : null}
              {badge ? badge(stage, active) : null}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const SceneHeading: React.FC<{
  frame: number;
  fps: number;
  children: React.ReactNode;
  color?: string;
  at?: number;
}> = ({ frame, fps, children, color = colors.gray, at = 0.3 }) => (
  <div
    style={{
      fontFamily: fonts.heading,
      fontSize: 62,
      fontWeight: 800,
      color,
      textAlign: 'center',
      opacity: fadeAt(frame, fps, at, 0.5),
    }}
  >
    {children}
  </div>
);
