'use client';

import { useEffect, useRef, useState } from 'react';
import { applyExtraction, extract, nextQuestion, type Question } from '@/lib/parse-chat';
import { detectQuestion, respond } from '@/lib/answers';
import { cloneBooking } from '@/lib/fixtures';
import type { Booking, Item } from '@/lib/types';

type Msg =
  | { kind: 'seller'; id: number; text: string }
  | { kind: 'assistant'; id: number; text: string }
  | { kind: 'answer'; id: number; summary: string; detail: string[] }
  | { kind: 'system'; id: number; text: string }
  | { kind: 'item-form'; id: number; sku: string };

type MsgInput =
  | { kind: 'seller'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'answer'; summary: string; detail: string[] }
  | { kind: 'system'; text: string }
  | { kind: 'item-form'; sku: string };

const OPENING =
  'Tell me about the shipment in your own words, or ask me about one that is already ' +
  'loaded. I answer on status, dates, weight, carrier, cost and what to do next.';

let nextId = 1;
const mk = (m: MsgInput): Msg => ({ ...m, id: nextId++ });

/** Offered once a booking is complete enough to have answers. */
const ASK_CHIPS = [
  'What is the status?',
  'When will it deliver?',
  'Which carrier and why?',
  'What do I do next?',
  'How much is at risk?',
];

export function Chat({
  booking, bookings, today, onApply, onSelectBooking,
}: {
  booking: Booking;
  bookings: Booking[];
  today: Date;
  onApply: (mutate: (b: Booking) => void) => void;
  onSelectBooking: (id: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>(() => [mk({ kind: 'assistant', text: OPENING })]);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const watched = useRef(booking.id);

  const missing: Question | null = nextQuestion(booking);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Switching shipments in the queue switches what the rail is watching.
  useEffect(() => {
    if (watched.current === booking.id) return;
    watched.current = booking.id;
    const q = nextQuestion(booking);
    setMessages((m) => [
      ...m,
      mk({ kind: 'system', text: `Now watching ${booking.id}` }),
      mk({
        kind: 'assistant',
        text: q
          ? `${booking.id} is missing a few things. ${q.text}`
          : `${booking.id} is loaded and checked. Ask me anything about it, or tell me what to change.`,
      }),
    ]);
  }, [booking]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDraft('');
    const added: Msg[] = [mk({ kind: 'seller', text: trimmed })];

    // A question is answered from the engine. Only a shipment detail is parsed.
    const question = detectQuestion(trimmed);
    if (question) {
      const a = respond(question, booking, bookings, today);
      if (a.switchTo) {
        // Pre-empt the watcher so the switch is announced once, here.
        watched.current = a.switchTo;
        onSelectBooking(a.switchTo);
        added.push(mk({ kind: 'system', text: `Now watching ${a.switchTo}` }));
      }
      added.push(mk({ kind: 'answer', summary: a.summary, detail: a.detail }));
      setMessages((m) => [...m, ...added]);
      return;
    }

    const extraction = extract(trimmed, booking, today);
    let changes: { label: string }[] = [];
    onApply((b) => { changes = applyExtraction(b, extraction); });

    for (const c of changes) added.push(mk({ kind: 'system', text: c.label }));
    for (const item of extraction.items) added.push(mk({ kind: 'item-form', sku: item.sku }));

    const after = cloneBooking(booking);
    applyExtraction(after, extraction);
    const q = nextQuestion(after);

    if (changes.length === 0 && extraction.items.length === 0) {
      added.push(mk({
        kind: 'assistant',
        text:
          'I could not read that as a shipment detail or as a question I answer. For details I ' +
          'read cities, pallets, cartons, weight in kilos, a value in pounds, a date, warehouse ' +
          'or business address, whether a slot is booked, and product lines. For questions, try ' +
          '"what is the status", "when will it deliver", "which carrier", "how much is at risk" ' +
          'or "what do I do next". ' + (q ? q.text : ''),
      }));
    } else if (q) {
      added.push(mk({ kind: 'assistant', text: q.text }));
    } else {
      added.push(mk({
        kind: 'assistant',
        text:
          'That is everything I need. All ten rules and the carrier ranking have re-run. Ask me ' +
          'for the status, the dates or the carrier, or tell me what to change.',
      }));
    }
    setMessages((m) => [...m, ...added]);
  }

  const chips = missing ? missing.quickReplies : ASK_CHIPS;

  return (
    <>
      <div className="rail-head">
        <h2 className="t-section">Conversation</h2>
        <p className="rail-status t-small">
          <span className="dot" aria-hidden="true" />
          {booking.seller || booking.destCity ? `Watching ${booking.id}` : 'Ready when you are'}
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
          if (m.kind === 'answer') {
            return <AnswerBubble key={m.id} summary={m.summary} detail={m.detail} />;
          }
          return <div key={m.id} className="bubble" data-from={m.kind}>{m.text}</div>;
        })}
      </div>

      {chips.length > 0 && (
        <div className="quick-replies">
          {chips.map((q) => (
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
            placeholder={missing ? '3 pallets from Manchester to Frankfurt, 700 kg…' : 'Ask about status, dates, carrier or cost…'}
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
          Answers are read straight off the rulebook, never from a model. Nothing here leaves the browser.
        </p>
      </div>
    </>
  );
}

/** The suggestion first; the reasoning behind it on request. */
function AnswerBubble({ summary, detail }: { summary: string; detail: string[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <div className="bubble answer" data-from="assistant">
      <p className="t-card-title">{summary}</p>
      {detail.length > 0 && (
        <details
          className="answer-why"
          ref={ref}
          onToggle={() => {
            // Opening it adds height below the fold, so bring it into view.
            if (ref.current?.open) {
              ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }}
        >
          <summary className="t-small">Why, and what happens next</summary>
          <div className="answer-detail t-small">
            {detail.map((line, n) =>
              line === ''
                ? <span key={n} className="answer-gap" />
                : <p key={n} className={/^\s{2}/.test(line) ? 'answer-sub' : undefined}>{line.trim()}</p>,
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Pre-filled with whatever was understood, and editable, so a misread costs a
 * correction rather than a dead end.
 */
function ItemForm({ item, onApply }: { item: Item; onApply: (mutate: (b: Booking) => void) => void }) {
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
      <p className="t-label" style={{ marginTop: 2 }}>This is what I understood. Correct anything I got wrong.</p>
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
      <input id={`f-${label}`} className={`input${mono ? ' t-mono' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
