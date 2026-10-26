'use client';

import { useState } from 'react';
import { c, font, tnum } from './tokens';
import { Button, Card, Footnote, Page, PageHeader, Pill, RuleTag } from './ui';
import { gbp } from '@/lib/format';
import type { Finding, QueueStats, Shipment } from '@/lib/dashboard';

/**
 * Screen 2 — Exception queue.
 *
 * Inverts the dossier: instead of browsing shipment by shipment, you work a
 * ranked list of findings, blockers first and worst money first inside that.
 * Every figure comes from the engine by way of toFindings().
 */

const EMPTY: Shipment = {
  id: '', seller: '', lane: '', riskGbp: null, tally: '', stage: '', blocked: false, rules: [],
};

function QueueRow({
  finding,
  shipment,
  selected,
  onSelect,
}: {
  finding: Finding;
  shipment: Shipment;
  selected: boolean;
  onSelect: () => void;
}) {
  const s = shipment;
  const counts = s.rules.reduce(
    (acc, v) => {
      if (v === 'fail') acc.fail += 1;
      if (v === 'warn') acc.warn += 1;
      return acc;
    },
    { fail: 0, warn: 0 },
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '13px 14px',
        borderRadius: 11,
        cursor: 'pointer',
        fontFamily: 'inherit',
        marginBottom: 4,
        background: selected ? c.raised : 'transparent',
        border: `1px solid ${selected ? c.borderRaised : 'transparent'}`,
        color: c.text,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
        }}
      >
        <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 600 }}>
          {s.id} <span style={{ color: c.textMute, fontWeight: 500 }}>{finding.rule}</span>
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            ...tnum,
            color: selected ? c.accent : c.textSoft,
          }}
        >
          {gbp(finding.riskGbp)}
        </span>
      </span>
      <span
        style={{
          display: 'block',
          width: '100%',
          fontSize: 12,
          color: c.textMute,
          marginTop: 4,
        }}
      >
        {finding.title}
      </span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <Pill bg={finding.stops ? c.failBg : c.warnBg} fg={finding.stops ? c.fail : c.warn} nowrap>
          {finding.stops ? 'Stops the shipment' : 'Costs time or money'}
        </Pill>
        <Pill bg={c.panel2} fg={c.textMute} nowrap>
          {counts.fail} blocking on {s.id}
        </Pill>
        {counts.warn > 0 ? (
          <Pill bg={c.warnBg} fg={c.warn}>
            {counts.warn} cost {counts.warn === 1 ? 'flag' : 'flags'}
          </Pill>
        ) : null}
      </span>
    </button>
  );
}

function Detail({ f, shipment }: { f: Finding; shipment: Shipment }) {
  const s = shipment;
  const confFg = f.confidence === 'high' ? c.pass : c.warn;
  const confLabel =
    f.confidence === 'high'
      ? 'High confidence in this diagnosis'
      : f.confidence === 'medium'
        ? 'Medium confidence in this diagnosis'
        : 'Needs a person, not a one-click fix';

  return (
    <Card style={{ padding: '24px 26px', gap: 18 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.3 }}>{f.title}</h2>
          <span style={{ fontSize: 13, color: c.textMute }}>
            {s.id} · {s.seller} · {s.lane}
          </span>
        </div>
        <RuleTag
          id={f.rule}
          fg={f.stops ? c.fail : c.warn}
          bg={f.stops ? c.failBg : c.warnBg}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 1,
          background: c.border,
          border: `1px solid ${c.border}`,
          borderRadius: 11,
          overflow: 'hidden',
        }}
      >
        {[
          { k: 'Found', v: f.found },
          { k: 'Expected', v: f.expected },
        ].map((cell) => (
          <div
            key={cell.k}
            style={{
              background: c.panel2,
              padding: '15px 17px',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: c.textMute,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {cell.k}
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.5 }}>{cell.v}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          borderLeft: `3px solid ${c.fail}`,
          padding: '2px 0 2px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: c.textMute,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Consequence
        </span>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: c.textDim }}>
          {f.consequence}
        </p>
      </div>

      <div
        style={{
          background: c.panel2,
          border: `1px solid ${c.border}`,
          borderRadius: 11,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: c.textDim }}>{f.diagnosis}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: confFg }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: confFg }}>{confLabel}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Button>{f.fix}</Button>
        <span style={{ fontSize: 13, fontWeight: 500, color: c.pass }}>{f.fixNote}</span>
      </div>

      {f.also ? (
        <div
          style={{
            background: '#221E16',
            border: '1px solid #3D3524',
            borderRadius: 11,
            padding: '14px 17px',
            fontSize: 13,
            lineHeight: 1.6,
            color: '#E0D3B8',
          }}
        >
          {f.also}
        </div>
      ) : null}

      <div
        style={{
          borderTop: `1px solid ${c.border}`,
          paddingTop: 16,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: c.textMute,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Owner
          </span>
          <span style={{ fontSize: 14, color: c.textDim }}>{f.owner}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: c.textMute,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Clears at
          </span>
          <Pill bg={c.accentBg} fg={c.accent}>
            {f.stage}
          </Pill>
        </div>
      </div>
    </Card>
  );
}

export default function ExceptionQueue({
  findings,
  shipments,
  stats,
  onDownload,
  onApplyAll,
}: {
  findings: Finding[];
  shipments: Shipment[];
  stats: QueueStats;
  onDownload?: () => void;
  onApplyAll?: () => void;
}) {
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const picked = findings.find((f) => f.key === pickedKey) ?? findings[0] ?? null;
  const shipmentOf = (id: string) => shipments.find((x) => x.id === id) ?? EMPTY;

  const quiet = stats.quiet;

  return (
    <Page>
      <PageHeader
        title="Exception queue"
        blurb={
          findings.length === 0
            ? 'Nothing is firing on the bookings you have loaded.'
            : `${stats.total} ${stats.total === 1 ? 'finding' : 'findings'} across ${stats.bookings} ${stats.bookings === 1 ? 'booking' : 'bookings'}, blockers first. Work the list, not the shipments.`
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {onDownload && (
            <Button variant="ghost" onClick={onDownload}>Download corrected sheet</Button>
          )}
          {onApplyAll && stats.oneClick > 0 && (
            <Button onClick={onApplyAll}>
              Apply {stats.oneClick} one-click {stats.oneClick === 1 ? 'fix' : 'fixes'}
            </Button>
          )}
        </div>
      </PageHeader>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <div
          style={{
            flex: '1 1 200px',
            background: c.failBg,
            border: `1px solid ${c.alertBorder}`,
            borderRadius: 11,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: c.fail, ...tnum }}>
            {gbp(stats.exposure)}
          </span>
          <span style={{ fontSize: 13, color: c.alertText }}>held up right now</span>
        </div>
        {[
          { n: stats.oneClick, t: stats.oneClick === 1 ? 'is a one-click correction' : 'are one-click corrections' },
          { n: stats.needsPerson, t: stats.needsPerson === 1 ? 'needs a person to decide' : 'need a person to decide' },
        ].map((x) => (
          <div
            key={x.t}
            style={{
              flex: '1 1 200px',
              background: c.panel,
              border: `1px solid ${c.border}`,
              borderRadius: 11,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 700, ...tnum }}>{x.n}</span>
            <span style={{ fontSize: 13, color: c.textMute }}>{x.t}</span>
          </div>
        ))}
      </div>

      {findings.length === 0 ? (
        <Card>
          <p style={{ margin: 0, fontSize: 14, color: c.textSoft }}>
            {shipments.length === 0
              ? 'Nothing is loaded. Open a shipment or load the demo set and the findings land here.'
              : 'Every rule passes on every booking in the book. There is nothing to work.'}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <Card style={{ padding: '20px 10px 14px', gap: 4 }}>
              <h2 style={{ margin: '0 14px 10px', fontSize: 17, fontWeight: 600 }}>Queue</h2>
              {findings.map((f) => (
                <QueueRow
                  key={f.key}
                  finding={f}
                  shipment={shipmentOf(f.shipmentId)}
                  selected={picked !== null && f.key === picked.key}
                  onSelect={() => setPickedKey(f.key)}
                />
              ))}
              {quiet.length > 0 && (
                <div style={{ margin: '10px 14px 0' }}>
                  <Footnote>
                    {quiet.join(', ')} {quiet.length === 1 ? 'is' : 'are'} not in the queue.
                    Nothing is firing.
                  </Footnote>
                </div>
              )}
            </Card>
          </div>

          <div style={{ flex: '999 1 560px', minWidth: 0 }}>
            {picked && <Detail f={picked} shipment={shipmentOf(picked.shipmentId)} />}
          </div>
        </div>
      )}
    </Page>
  );
}
