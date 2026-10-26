'use client';

import { useState } from 'react';
import { gbp } from '@/lib/format';
import { bandOf, type Band, type Book, type Shipment, type Verdict } from '@/lib/dashboard';
import { c, font, tnum, verdictColor } from './tokens';
import {
  Button,
  Card,
  CardHeader,
  Footnote,
  Page,
  PageHeader,
  Pill,
  SplitRow,
  StatTile,
  TableScroll,
  Td,
  Th,
  TileGrid,
} from './ui';

/**
 * Screen 1 — Control tower.
 *
 * The portfolio layer the dossier is missing: today this data only exists
 * one booking at a time. Every figure comes from `toBook()`, which reads
 * the engine's own output — nothing on this screen is computed twice.
 */

const TABS: Array<{ band: Band; label: string }> = [
  { band: 'all', label: 'All' },
  { band: 'blocked', label: 'Blocked' },
  { band: 'caution', label: 'Caution' },
  { band: 'clear', label: 'Clear' },
];

/** A share ramp, not a verdict scale — these bars say how much, not how bad. */
const BARS = [c.textSoft, c.textMute, c.neutral, c.textFaint, c.borderRaised];

/** How many of the worst bookings the side card names before it stops. */
const PRIORITY_LIMIT = 4;

const PILL: Record<Exclude<Band, 'all'>, { bg: string; fg: string }> = {
  blocked: { bg: c.failBg, fg: c.fail },
  caution: { bg: c.warnBg, fg: c.warn },
  clear: { bg: c.passBg, fg: c.pass },
};

function RuleStrip({ rules }: { rules: Verdict[] }) {
  return (
    <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
      {rules.map((v, i) => (
        <span
          key={i}
          style={{
            width: 17,
            height: 7,
            borderRadius: 2,
            background: verdictColor[v],
          }}
        />
      ))}
    </div>
  );
}

function FilterTab({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        minHeight: 38,
        padding: '0 15px',
        borderRadius: 9,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        background: on ? c.accent : c.panel,
        color: on ? c.accentInk : c.textSoft,
        border: `1px solid ${on ? c.accent : c.border}`,
      }}
    >
      {children}
    </button>
  );
}

/** The booking id, as a real link when there is somewhere to go. */
function BookingLink({
  id,
  href,
  onOpen,
}: {
  id: string;
  href?: string;
  onOpen?: (id: string) => void;
}) {
  const style = {
    fontFamily: font.mono,
    fontSize: 13,
    fontWeight: 600,
    color: c.text,
    background: 'none',
    border: 0,
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    textDecorationColor: c.borderRaised,
  } as const;

  if (onOpen) {
    return (
      <button type="button" style={style} onClick={() => onOpen(id)}>
        {id}
      </button>
    );
  }
  return (
    <a href={href ?? `/shipments/${id}`} style={style}>
      {id}
    </a>
  );
}

export default function ControlTower({
  book,
  onOpen,
  hrefFor,
  onQueue,
}: {
  book: Book;
  /** Select a booking inside the app. Falls back to `hrefFor` when absent. */
  onOpen?: (id: string) => void;
  hrefFor?: (id: string) => string;
  onQueue?: () => void;
}) {
  const [filter, setFilter] = useState<Band>('all');

  const { shipments, totalExposure, counts, exposure } = book;
  const rows = filter === 'all' ? shipments : shipments.filter((s) => bandOf(s) === filter);

  return (
    <Page>
      <PageHeader title="Control tower" blurb={book.blurb}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <FilterTab key={t.band} on={filter === t.band} onClick={() => setFilter(t.band)}>
              {t.label} {counts[t.band]}
            </FilterTab>
          ))}
        </div>
      </PageHeader>

      <TileGrid>
        <StatTile
          label="Exposure"
          value={gbp(totalExposure)}
          note={
            exposure.length === 0
              ? 'nothing carries a cost estimate'
              : `across ${exposure.length} booking${exposure.length === 1 ? '' : 's'}`
          }
        />
        <StatTile
          label="Blocked"
          value={`${counts.blocked} of ${counts.all}`}
          note="will be held or refused"
        />
        <StatTile
          label="Blocking failures"
          value={String(book.blockingFailures)}
          note="rules that stop a shipment"
          valueColor={c.fail}
        />
        <StatTile
          label="Time or money"
          value={String(book.costFlags)}
          note="cost you, do not stop you"
          valueColor={c.warn}
        />
        <StatTile
          label="Clear to ship"
          value={String(counts.clear)}
          note={book.clearNote}
          valueColor={counts.clear > 0 ? c.pass : c.textFaint}
        />
      </TileGrid>

      <SplitRow
        main={
          <Card>
            <CardHeader title="The book" aside="Each strip is R-01 to R-10, left to right" />
            <TableScroll>
              <thead>
                <tr>
                  <Th>Booking</Th>
                  <Th>Lane</Th>
                  <Th>Ten rules</Th>
                  <Th align="right">At risk</Th>
                  <Th align="right">Held at</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const band = bandOf(s);
                  return (
                    <tr key={s.id}>
                      <Td>
                        <BookingLink id={s.id} href={hrefFor?.(s.id)} onOpen={onOpen} />
                        <div style={{ marginTop: 3, fontSize: 12, color: c.textMute }}>
                          {s.seller}
                        </div>
                      </Td>
                      <Td style={{ color: c.textDim }}>{s.lane}</Td>
                      <Td>
                        <RuleStrip rules={s.rules} />
                        <span style={{ fontSize: 11, color: c.textMute }}>{s.tally}</span>
                      </Td>
                      <Td
                        align="right"
                        style={{
                          ...tnum,
                          fontWeight: 600,
                          color: s.riskGbp === null ? c.textFaint : c.text,
                        }}
                      >
                        {s.riskGbp === null ? '—' : gbp(s.riskGbp)}
                      </Td>
                      <Td align="right">
                        <Pill bg={PILL[band].bg} fg={PILL[band].fg} nowrap>
                          {s.stage}
                        </Pill>
                      </Td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '18px 0', color: c.textMute }}>
                      Nothing in this band.
                    </td>
                  </tr>
                )}
              </tbody>
            </TableScroll>
          </Card>
        }
        side={
          <>
            <Card>
              <CardHeader title="Where the money sits" />
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: c.textSoft }}>
                {book.moneyBlurb}
              </p>

              {exposure.length > 0 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      height: 12,
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: c.borderSoft,
                    }}
                  >
                    {exposure.map((e, i) => (
                      <span
                        key={e.id}
                        style={{ width: e.width, background: BARS[i % BARS.length] }}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {exposure.map((e, i) => (
                      <div
                        key={e.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}
                      >
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 2,
                            flex: 'none',
                            background: BARS[i % BARS.length],
                          }}
                        />
                        <span style={{ flex: 1, minWidth: 0, color: c.textDim }}>{e.name}</span>
                        <span style={{ ...tnum, color: c.textMute }}>{e.pct}%</span>
                        <span style={{ ...tnum, fontWeight: 600, width: 64, textAlign: 'right' }}>
                          {gbp(e.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {book.priorities.length > 0 && (
              <Card>
                <CardHeader title="Do these first" />
                <ol
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {book.priorities.slice(0, PRIORITY_LIMIT).map((p, i) => (
                    <li key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span
                        style={{
                          flex: 'none',
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          background: c.control,
                          color: c.textDim,
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: c.textDim }}>
                        <strong style={{ color: c.text, fontFamily: font.mono }}>{p.id}</strong>
                        {' — '}
                        {p.why}.
                      </span>
                    </li>
                  ))}
                </ol>
                {book.priorities.length > PRIORITY_LIMIT && (
                  <Footnote>
                    {book.priorities.length - PRIORITY_LIMIT} more{' '}
                    {book.priorities.length - PRIORITY_LIMIT === 1 ? 'booking needs' : 'bookings need'}{' '}
                    work. They are all in the table.
                  </Footnote>
                )}
                {onQueue && <Button onClick={onQueue}>Open the exception queue</Button>}
              </Card>
            )}
          </>
        }
      />

      <Card>
        <CardHeader title="Lanes" aside="Every lane in the book, and what is sitting on it" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 12,
          }}
        >
          {shipments.map((s) => {
            const band = bandOf(s);
            return (
              <div
                key={s.id}
                style={{
                  border: `1px solid ${c.border}`,
                  borderRadius: 11,
                  padding: '15px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                  background: c.panel2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flex: 'none',
                      background: PILL[band].fg,
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.lane}</span>
                </div>
                <span style={{ fontSize: 12, color: c.textMute }}>{s.seller}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: PILL[band].fg }}>
                  {band === 'clear' ? 'Clear to ship' : s.tally}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Footnote>
        Every figure on this screen is read from the bookings loaded in this browser. Nothing is
        uploaded, stored or sent anywhere.
      </Footnote>
    </Page>
  );
}
