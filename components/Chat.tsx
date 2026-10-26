'use client';

import { useEffect, useRef, useState } from 'react';
import {
  applyExtraction, extract, nextQuestion, type Question,
} from '@/lib/parse-chat';
import { cloneBooking } from '@/lib/fixtures';
import type { Booking, Item } from '@/lib/types';

type Msg =
  | { kind: 'seller'; id: number; text: string }
  | { kind: 'assistant'; id: number; text: string }
  | { kind: 'system'; id: number; text: string }
  | { kind: 'item-form'; id: number; sku: string };

const OPENING =
  'Tell me about the shipment in your own words. Everything at once is fine, and so is one ' +
  'thing at a time. I will ask for whatever is left.';

let nextId = 1;
type MsgInput =
  | { kind: 'seller'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'system'; text: string }
  | { kind: 'item-form'; sku: string };
const mk = (m: MsgInput): Msg => ({ ...m, id: nextId++ });

export function Chat({
  booking, today, onApply,
}: {
  booking: Booking;
  today: Date;
  onApply: (mutate: (b: Booking) => void) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>(() => [mk({ kind: 'assistant', text: OPENING })]);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const watched = useRef(booking.id);

  // Derived, not stored: the quick replies always offer what is actually
  // still missing from the booking on screen.
  const question: Question | null = nextQuestion(booking);

  // Switching shipments in the queue switches what the rail is watching.
  useEffect(() => {
    if (watched.current === booking.id) return;
    watched.current = booking.id;
    setMessages((m) => [
      ...m,
      mk({ kind: 'system', text: `Now watching ${booking.id}` }),
      mk({
        kind: 'assistant',
        text: nextQuestion(booking)
          ? `${booking.id} is missing a few things. ${nextQuestion(booking)!.text}`
          : `${booking.id} is loaded and checked. Tell me what to change and I will re-run all ten rules.`,
      }),
    ]);
  }, [booking]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDraft('');

    const extraction = extract(trimmed, booking, today);
    const added: Msg[] = [mk({ kind: 'seller', text: trimmed })];

    let changes: { label: string }[] = [];
    onApply((b) => { changes = applyExtraction(b, extraction); });

    for (const c of changes) added.push(mk({ kind: 'system', text: c.label }));
    for (const item of extraction.items) added.push(mk({ kind: 'item-form', sku: item.sku }));

    // The booking in props is last render's copy, so replay the SAME
    // extraction onto a throwaway to work out what is still missing. Parsing
    // twice would be wasteful and would advance the generated-sku counter.
    const after = cloneBooking(booking);
    applyExtraction(after, extraction);
    const q = nextQuestion(after);

    if (changes.length === 0 && extraction.items.length === 0) {
      added.push(mk({
        kind: 'assistant',
        text:
          'I did not catch a shipment detail in that. I read cities, pallets, cartons, weight in ' +
          'kilos, a value in pounds, a date, whether it is a warehouse or a business address, ' +
          'whether a slot is booked, and product lines. ' + (q ? q.text : ''),
      }));
    } else if (q) {
      added.push(mk({ kind: 'assistant', text: q.text }));
    } else {
      added.push(mk({
        kind: 'assistant',
        text:
          'That is everything I need. The checks on the left have re-run against all ten rules and ' +
          'the carrier ranking is up to date. Change anything and I will run them again.',
      }));
    }

    setMessages((m) => [...m, ...added]);
  }

  return (
    <>
      <div className="rail-head">
        <h2 className="t-section">Conversation</h2>
        <p className="rail-status t-small">
          <span className="dot" aria-hidden="true" />
          {booking.seller || booking.destCity
            ? `Watching ${booking.id}`
            : 'Ready when you are'}
        </p>
      </div>

      <div className="rail-log" ref={logRef} aria-live="polite">
        {messages.map((m) => {
          if (m.kind === 'system') {
            return <div key={m.id} className="capsule" title={m.text}>{m.text}</div>;
          }
          if (m.kind === 'item-form') {
            const item = booking.items.find((i) => i.sku === m.sku);
            if (!item) return null;
            return <ItemForm key={m.id} item={item} onApply={onApply} />;
          }
          return (
            <div key={m.id} className="bubble" data-from={m.kind}>{m.text}</div>
          );
        })}
      </div>

      {question && question.quickReplies.length > 0 && (
        <div className="quick-replies">
          {question.quickReplies.map((q) => (
            <button key={q} type="button" className="quick-reply" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      )}

      <div className="composer">
        <div className="composer-well">
          <label className="sr-only" htmlFor="composer">Message</label>
          <textarea
            id="composer"
            rows={1}
            value={draft}
            placeholder="3 pallets from Manchester to Frankfurt, 700 kg…"
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); }
            }}
          />
          <button type="button" className="send" onClick={() => send(draft)} disabled={!draft.trim()} aria-label="Send">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 13V3" /><path d="M3.5 7.5 8 3l4.5 4.5" />
            </svg>
          </button>
        </div>
        <p className="t-label" style={{ marginTop: 7 }}>
          Read by a fixed set of patterns, never by a model. Nothing here leaves the browser.
        </p>
      </div>
    </>
  );
}

/**
 * Pre-filled with whatever was understood, and editable, so a misread costs a
 * correction rather than a dead end.
 */
function ItemForm({
  item, onApply,
}: {
  item: Item;
  onApply: (mutate: (b: Booking) => void) => void;
}) {
  const set = (field: keyof Item, raw: string) => {
    onApply((b) => {
      const target = b.items.find((i) => i.sku === item.sku);
      if (!target) return;
      if (field === 'sku' || field === 'description' || field === 'hsCode' || field === 'countryOfOrigin') {
        (target as unknown as Record<string, unknown>)[field] = raw;
      } else {
        const n = raw.trim() === '' ? null : Number(raw.replace(/[^0-9.-]/g, ''));
        (target as unknown as Record<string, unknown>)[field] = n === null || Number.isNaN(n) ? null : n;
      }
    });
  };

  const num = (v: number | null) => (v === null ? '' : String(v));

  return (
    <div className="item-form">
      <p className="t-card-title">{item.sku}</p>
      <p className="t-label" style={{ marginTop: 2 }}>
        This is what I understood. Correct anything I got wrong.
      </p>
      <div className="item-form-grid">
        <Field label="Description" value={item.description} onChange={(v) => set('description', v)} wide />
        <Field label="HS code" value={item.hsCode} onChange={(v) => set('hsCode', v)} mono />
        <Field label="Country of origin" value={item.countryOfOrigin} onChange={(v) => set('countryOfOrigin', v)} />
        <Field label="Quantity" value={num(item.quantity)} onChange={(v) => set('quantity', v)} />
        <Field label="Unit price" value={num(item.unitPrice)} onChange={(v) => set('unitPrice', v)} />
        <Field label="Units per carton" value={num(item.unitsPerCarton)} onChange={(v) => set('unitsPerCarton', v)} />
        <Field label="Cartons" value={num(item.cartons)} onChange={(v) => set('cartons', v)} />
        <Field label="Unit weight, kg" value={num(item.unitWeight)} onChange={(v) => set('unitWeight', v)} />
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, mono, wide,
}: {
  label: string; value: string; onChange: (v: string) => void; mono?: boolean; wide?: boolean;
}) {
  return (
    <div className="field" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label className="t-label" htmlFor={`f-${label}`}>{label}</label>
      <input
        id={`f-${label}`}
        className={`input${mono ? ' t-mono' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
