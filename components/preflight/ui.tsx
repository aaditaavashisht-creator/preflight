import { Children, type CSSProperties, type ReactNode } from 'react';
import { c, font, tnum } from './tokens';

/**
 * Small shared primitives for the Pre-Flight screens.
 *
 * Everything is inline-styled on purpose: these drop into any React app
 * with no Tailwind config, CSS import or build step to line up first.
 * If you are on Tailwind, these are the pieces to convert — the screens
 * themselves mostly compose them.
 */

export function Page({ children }: { children: ReactNode }) {
  return (
    <main
      id="content"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: 'clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px) 36px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        background: c.bg,
        color: c.text,
        fontFamily: font.sans,
      }}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: c.textMute }}>{blurb}</p>
      </div>
      {children}
    </div>
  );
}

export function Card({
  children,
  style,
  accentBorder,
}: {
  children: ReactNode;
  style?: CSSProperties;
  accentBorder?: string;
}) {
  return (
    <div
      style={{
        background: c.panel,
        border: `1px solid ${accentBorder ?? c.border}`,
        borderRadius: 14,
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h2>
      {typeof aside === 'string' ? (
        <span style={{ fontSize: 12, color: c.textMute }}>{aside}</span>
      ) : (
        aside
      )}
    </div>
  );
}

export function StatTile({
  label,
  value,
  note,
  valueColor,
  mono,
}: {
  label: string;
  value: string;
  note?: string;
  valueColor?: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: c.panel,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: c.textMute,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: valueColor ?? c.text,
          fontFamily: mono ? font.mono : undefined,
          ...tnum,
        }}
      >
        {value}
      </span>
      {note ? <span style={{ fontSize: 12, color: c.textMute }}>{note}</span> : null}
    </div>
  );
}

/**
 * Responsive tile row. Wraps to one column on a phone.
 *
 * Flex rather than grid, because an odd number of tiles in a grid leaves the
 * last row short and the hole reads as a missing tile. Here the stragglers
 * grow to fill their row instead.
 */
export function TileGrid({ children, min = 196 }: { children: ReactNode; min?: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {Children.map(children, (child) => (
        <div style={{ flex: `1 1 ${min}px`, minWidth: 0, display: 'flex' }}>{child}</div>
      ))}
    </div>
  );
}

/**
 * Two-column body that collapses on narrow screens.
 * `main` takes the slack, `side` holds its width until there is no room.
 */
export function SplitRow({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
      <div style={{ flex: '999 1 600px', minWidth: 0 }}>{main}</div>
      <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {side}
      </div>
    </div>
  );
}

export function Pill({
  children,
  bg,
  fg,
  nowrap,
}: {
  children: ReactNode;
  bg: string;
  fg: string;
  /** Keep a short phrase on one line; two lines read as two pills. */
  nowrap?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        background: bg,
        color: fg,
        whiteSpace: nowrap ? 'nowrap' : undefined,
      }}
    >
      {children}
    </span>
  );
}

export function RuleTag({ id, fg, bg }: { id: string; fg: string; bg: string }) {
  return (
    <span
      style={{
        fontFamily: font.mono,
        fontSize: 12,
        fontWeight: 600,
        padding: '5px 10px',
        borderRadius: 7,
        background: bg,
        color: fg,
        flex: 'none',
      }}
    >
      {id}
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const primary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        minHeight: 44, // touch target
        padding: '0 18px',
        borderRadius: 10,
        background: primary ? c.accent : c.panel,
        border: `1px solid ${primary ? c.accent : c.border}`,
        color: primary ? c.accentInk : c.textSoft,
        fontSize: 13,
        fontWeight: primary ? 600 : 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/** Column headers for the data tables. */
export function Th({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      scope="col"
      style={{
        textAlign: align,
        padding: align === 'right' ? '0 0 10px 12px' : '0 12px 10px 0',
        fontSize: 11,
        fontWeight: 500,
        color: c.textMute,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderBottom: `1px solid ${c.border}`,
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  style,
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  style?: CSSProperties;
}) {
  return (
    <td
      style={{
        padding: '13px 12px 13px 0',
        borderBottom: `1px solid ${c.borderSoft}`,
        textAlign: align,
        verticalAlign: 'top',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

/**
 * Wide tables scroll inside their card rather than blowing out the page.
 * Focusable, because a region that scrolls and cannot be reached by keyboard
 * hides its own columns from anyone without a pointer.
 */
export function TableScroll({
  children,
  min = 620,
  label,
}: {
  children: ReactNode;
  min?: number;
  label?: string;
}) {
  return (
    <div tabIndex={0} role="region" aria-label={label ?? 'Scrollable table'} style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: min, fontSize: 13, borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  );
}

export function Footnote({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: c.textFaint, lineHeight: 1.5 }}>{children}</p>
  );
}
