import React from 'react';

interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  style?: React.CSSProperties;
}

/**
 * A single pulsing placeholder block. Uses the `.skeleton-pulse` class defined in
 * index.css (plain CSS opacity animation, respects prefers-reduced-motion) — no
 * animation library, no Tailwind (neither exists in this project).
 */
export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = '100%',
  height = '1rem',
  radius = '6px',
  style,
}) => (
  <div
    className="skeleton-pulse"
    style={{
      width,
      height,
      borderRadius: radius,
      backgroundColor: 'var(--gray-200)',
      ...style,
    }}
  />
);

/**
 * Matches the real row rendered by BookingRequestsPage.tsx's `.booking-list-item`
 * (index.css: padding 1.25rem, border-radius 16px, border 1px solid var(--gray-100),
 * margin-bottom 0.75rem) — sized so swapping it for real content causes no layout jump.
 */
export const SkeletonListRow: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      padding: '1.25rem',
      background: 'var(--white)',
      borderRadius: '16px',
      border: '1px solid var(--gray-100)',
      marginBottom: '0.75rem',
    }}
  >
    <SkeletonBlock width="48px" height="48px" radius="12px" style={{ flexShrink: 0 }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <SkeletonBlock width="40%" height="0.85rem" />
      <SkeletonBlock width="60%" height="0.75rem" />
    </div>
    <SkeletonBlock width="90px" height="0.9rem" />
  </div>
);

/**
 * Matches the real card rendered by MyBookingsPage.tsx (white bg, 16px radius, 1.5rem
 * padding, border 1px solid #eee, a 150x100 image block + a title/meta text stack).
 */
export const SkeletonCard: React.FC = () => (
  <div
    style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: 'var(--shadow-soft)',
      border: '1px solid #eee',
      display: 'flex',
      gap: '2rem',
      alignItems: 'center',
    }}
  >
    <SkeletonBlock width="150px" height="100px" radius="12px" style={{ flexShrink: 0 }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '200px' }}>
      <SkeletonBlock width="45%" height="1.1rem" />
      <SkeletonBlock width="65%" height="0.85rem" />
      <SkeletonBlock width="35%" height="0.85rem" />
    </div>
  </div>
);

/**
 * Wraps a group of skeleton rows/cards with the ARIA attributes screen readers need
 * to announce "loading" rather than reading placeholder blocks as real content.
 */
export const SkeletonGroup: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div aria-busy="true" aria-label="Loading" style={style}>
    {children}
  </div>
);
