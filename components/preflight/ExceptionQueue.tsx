'use client';

import { useState } from 'react';
import { c, font, tnum } from './tokens';
import { Button, Card, Footnote, Page, PageHeader, Pill, RuleTag } from './ui';
import { gbp, shipments, topFindings, totalExposure, type Finding } from './fixtures.data';

/**
 * Screen 2 — Exception queue.
 *
 * Inverts the live app: instead of browsing shipment by shipment, you work a
 * ranked list of findings. Four of the eleven are one-click corrections;
 * the rest need a person, and the screen says which is which.
 */

function QueueRow({
  finding,
  selected,
  onSelect,
}: {
  finding: Finding;
  selected: boolean;
  onSelect: () => void;
}) {
  const s = shipments.find((x) => x.id === finding.shipmentId)!;
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
        <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 600 }}>{s.id}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            ...tnum,
            color: selected ? c.accent : c.textSoft,
          }}
        >
          {gbp(s.riskGbp ?? 0)}
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
        {s.seller} · {s.lane}
      </span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <Pill bg={c.accentBg} fg={c.accent}>
          {counts.fail} blocking
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

function Detail({ f }: { f: Finding }) {
  const s = shipments.find((x) => x.id === f.shipmentId)!;
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
        <RuleTag id={f.rule} fg={c.fail} bg={c.failBg} />
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
            Held at
          </span>
          <Pill bg={c.accentBg} fg={c.accent}>
            {f.stage}
          </Pill>
        </div>
      </div>
    </Card>
  );
}

export default function ExceptionQueue() {
  const [pickedId, setPickedId] = useState(topFindings[0].shipmentId);
  const picked = topFindings.find((f) => f.shipmentId === pickedId)!;

  return (
    <Page>
      <PageHeader
        title="Exception queue"
        blurb="Eleven findings across four bookings, worst money first. Work the list, not the shipments."
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button variant="ghost">Download corrected sheet</Button>
          <Button>Apply 4 high-confidence fixes</Button>
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
            {gbp(totalExposure)}
          </span>
          <span style={{ fontSize: 13, color: c.alertText }}>held up right now</span>
        </div>
        {[
          { n: '4', t: 'are one-click corrections' },
          { n: '7', t: 'need a person to decide' },
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
          <Card style={{ padding: '20px 10px 14px', gap: 4 }}>
            <h2 style={{ margin: '0 14px 10px', fontSize: 17, fontWeight: 600 }}>Queue</h2>
            {topFindings.map((f) => (
              <QueueRow
                key={f.shipmentId}
                finding={f}
                selected={f.shipmentId === pickedId}
                onSelect={() => setPickedId(f.shipmentId)}
              />
            ))}
            <div style={{ margin: '10px 14px 0' }}>
              <Footnote>BK-105, Harrow Home, is not in the queue. All ten rules pass.</Footnote>
            </div>
          </Card>
        </div>

        <div style={{ flex: '999 1 560px', minWidth: 0 }}>
          <Detail f={picked} />
        </div>
      </div>
    </Page>
  );
}
