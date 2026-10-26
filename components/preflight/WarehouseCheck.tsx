'use client';

import { useState } from 'react';
import { c, font, tnum } from './tokens';
import { gbp } from '@/lib/format';
import type { CountTask } from '@/lib/dashboard';

/**
 * Screen 5 — Warehouse check.
 *
 * One task, phone-sized, for the person actually counting cartons. The
 * stepper is live: step to the number the item lines add up to and the
 * carton rule clears.
 *
 * Phone-width, centred, so it reads as the device task it is.
 */

export default function WarehouseCheck({
  task,
  onConfirm,
  onEscalate,
}: {
  task: CountTask;
  /** Writes the counted number back to the booking and re-runs the rules. */
  onConfirm?: (cartons: number) => void;
  /** The count is not the problem; hand it to whoever works the whole list. */
  onEscalate?: () => void;
}) {
  const b = task;
  const [count, setCount] = useState(b.bookingSays);

  // A different task means a fresh count, not the one left on screen.
  const [taskId, setTaskId] = useState(b.id);
  if (taskId !== b.id) {
    setTaskId(b.id);
    setCount(b.bookingSays);
  }

  const verdict =
    count === b.linesSay
      ? {
          text: `That matches the item lines. ${b.rule} clears.`,
          fg: c.pass,
          bg: '#16271F',
        }
      : count === b.bookingSays
        ? {
            text: 'This is the number on the booking, and it is the one the lines disagree with.',
            fg: c.warn,
            bg: c.warnBg,
          }
        : {
            text: `The item lines add up to ${b.linesSay}. Anything else needs the lines corrected too.`,
            fg: c.fail,
            bg: c.failBg,
          };

  const stepButton = {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: c.control,
    border: `1px solid ${c.borderControl}`,
    color: c.text,
    fontSize: 26,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    lineHeight: 1,
  } as const;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 390,
        minHeight: 620,
        margin: '0 auto',
        boxSizing: 'border-box',
        background: c.bg,
        color: c.text,
        fontFamily: font.sans,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          background: c.accent,
          padding: '18px 20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          flex: 'none',
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 700, color: c.accentInk }}>Pre-flight</span>
        <span style={{ fontSize: 12, color: '#4A2F18' }}>Counts agree · your stage</span>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontFamily: font.mono, fontSize: 15, fontWeight: 700 }}>{b.id}</span>
          <span style={{ fontSize: 13, color: c.textMute }}>{b.seller}</span>
          <span style={{ fontSize: 13, color: c.textMute }}>{b.lane}</span>
        </div>

        <div
          style={{
            background: c.alertBg,
            border: `1px solid ${c.alertBorder}`,
            borderRadius: 14,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 11,
          }}
        >
          <span style={{ fontSize: 23, fontWeight: 700, color: c.alertInk, lineHeight: 1.25 }}>
            Count the cartons before this goes
          </span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: c.alertText }}>
            The booking says {b.bookingSays}. The item lines add up to {b.linesSay}.{' '}
            {b.linesSay - b.bookingSays} cartons are unaccounted for, worth about{' '}
            {gbp(b.riskGbp)} if the receiving site raises a discrepancy.
          </p>
          <span
            style={{
              fontFamily: font.mono,
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 9px',
              borderRadius: 6,
              background: c.alertChip,
              color: c.alertInk,
              alignSelf: 'flex-start',
            }}
          >
            {b.rule}
          </span>
        </div>

        <div
          style={{
            background: c.panel,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 15,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: c.textMute,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            What did you count?
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <button
              type="button"
              onClick={() => setCount((n) => Math.max(0, n - 1))}
              aria-label="One fewer carton"
              style={stepButton}
            >
              −
            </button>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 44, fontWeight: 700, ...tnum, lineHeight: 1 }}>
                {count}
              </span>
              <span style={{ fontSize: 12, color: c.textMute }}>cartons</span>
            </div>
            <button
              type="button"
              onClick={() => setCount((n) => n + 1)}
              aria-label="One more carton"
              style={stepButton}
            >
              +
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '12px 14px',
              borderRadius: 10,
              background: verdict.bg,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flex: 'none',
                background: verdict.fg,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1.45,
                color: verdict.fg,
              }}
            >
              {verdict.text}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            style={{
              minHeight: 52,
              borderRadius: 12,
              background: c.accent,
              border: 'none',
              color: c.accentInk,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
            onClick={() => onConfirm?.(count)}
          >
            {count === b.bookingSays
              ? 'Confirm the count'
              : `Send ${count} back to the booking`}
          </button>
          <button
            type="button"
            style={{
              minHeight: 52,
              borderRadius: 12,
              background: c.panel,
              border: `1px solid ${c.border}`,
              color: c.textDim,
              fontSize: 15,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
            onClick={onEscalate}
          >
            Something else is wrong
          </button>
        </div>

        <div
          style={{
            borderTop: `1px solid ${c.borderSoft}`,
            paddingTop: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: c.textMute,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Who else is waiting
          </span>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: c.textMute }}>
            {b.onlyThing
              ? `Nothing else on ${b.id} is holding. Every other rule passes, so this count is the last thing between the pallet and the road.`
              : `Other rules are also holding ${b.id}, so clearing this count moves it on but does not release it on its own.`}
          </p>
        </div>
      </div>
    </div>
  );
}
