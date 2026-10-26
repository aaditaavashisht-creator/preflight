import { c, font, tnum, verdictColor } from './tokens';
import {
  Card,
  CardHeader,
  Footnote,
  Page,
  PageHeader,
  StatTile,
  TableScroll,
  TileGrid,
} from './ui';
import type { Finding, RuleCard, Shipment, StageLoad } from '@/lib/dashboard';

/**
 * Screen 3 — Rule and lane health.
 *
 * Every rule against every booking. The point of the matrix is the two
 * readings you cannot get from a per-shipment view: which rule bites most
 * often, and which stage is holding the book up.
 *
 * Static — no client state, so this can stay a server component.
 */

/** What a cell means, said out loud for anyone who cannot see its colour. */
const VERDICT_WORD: Record<string, string> = {
  pass: 'passes',
  fail: 'fails, and stops the shipment',
  warn: 'fires, and costs time or money',
  na: 'not applicable, never run',
};

export default function RuleHealth({
  shipments,
  rules,
  stageLoad,
  findings,
}: {
  shipments: Shipment[];
  rules: RuleCard[];
  stageLoad: StageLoad[];
  findings: Finding[];
}) {
  const blockedCount = shipments.filter((s) => s.blocked).length;

  // Each rule's row across the book, in the order the rules are listed.
  const matrix = rules.map((rule, ruleIndex) => {
    const cells = shipments.map((s) => s.rules[ruleIndex]);
    const hits = cells.filter((v) => v === 'fail' || v === 'warn').length;
    return { rule, cells, hits };
  });

  // Rules that never fired on this book.
  const quiet = matrix.filter((m) => m.hits === 0).map((m) => m.rule.id);

  const maxStage = Math.max(...stageLoad.map((s) => s.count), 1);
  const stops = findings.filter((f) => f.stops).length;
  const costs = findings.length - stops;
  const redRules = rules.filter((r) => r.stops).length;
  const amberRules = rules.length - redRules;
  const naCells = matrix.reduce((n, m) => n + m.cells.filter((v) => v === 'na').length, 0);
  const heldTotal = stageLoad.reduce((n, s) => n + s.count, 0);
  const heldStages = stageLoad.filter((s) => s.count > 0).length;
  const worstStage = stageLoad.reduce<StageLoad | null>(
    (best, s) => (s.count > 0 && (!best || s.count > best.count) ? s : best),
    null,
  );
  const busiest = matrix.reduce(
    (best, m) => (m.hits > best.hits ? m : best),
    { rule: { id: '—' }, hits: 0 } as { rule: { id: string }; hits: number },
  );

  return (
    <Page>
      <PageHeader
        title="Rule and lane health"
        blurb={`${rules.length} rules against ${shipments.length} ${shipments.length === 1 ? 'booking' : 'bookings'}. Which checks actually bite, and which stage holds the book up.`}
      />

      <TileGrid>
        <StatTile
          label="Findings"
          value={String(findings.length)}
          note={`across ${rules.length * shipments.length - naCells} rule runs`}
        />
        <StatTile
          label="Stop a shipment"
          value={String(stops)}
          note={`from the ${redRules} red rules`}
          valueColor={c.fail}
        />
        <StatTile
          label="Cost time or money"
          value={String(costs)}
          note={`from the ${amberRules} amber rules`}
          valueColor={c.warn}
        />
        <StatTile
          label="Fires most"
          value={busiest.hits === 0 ? '—' : busiest.rule.id}
          note={busiest.hits === 0 ? 'nothing fired on this book' : `hit ${busiest.hits} ${busiest.hits === 1 ? 'time' : 'times'}`}
          mono
        />
      </TileGrid>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 620px', minWidth: 0 }}>
          <Card>
            <CardHeader
              title="Every rule against every booking"
              aside={
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {[
                    { k: 'blocks', v: c.fail },
                    { k: 'costs', v: c.warn },
                    { k: 'passes', v: c.passCell },
                  ].map((l) => (
                    <span
                      key={l.k}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        color: c.textMute,
                      }}
                    >
                      <span
                        style={{ width: 9, height: 9, borderRadius: 2, background: l.v }}
                      />
                      {l.k}
                    </span>
                  ))}
                </div>
              }
            />

            <TableScroll label="Every rule against every booking" min={580}>
              <thead>
                <tr>
                  <th
                    scope="col"
                    style={{
                      textAlign: 'left',
                      padding: '0 12px 10px 0',
                      fontSize: 11,
                      fontWeight: 500,
                      color: c.textMute,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      borderBottom: `1px solid ${c.border}`,
                    }}
                  >
                    Rule
                  </th>
                  {shipments.map((s) => (
                    <th
                      key={s.id}
                      scope="col"
                      style={{
                        textAlign: 'center',
                        padding: '0 6px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: c.textSoft,
                        fontFamily: font.mono,
                        borderBottom: `1px solid ${c.border}`,
                      }}
                    >
                      {s.id.replace('BK-', '')}
                    </th>
                  ))}
                  <th
                    scope="col"
                    style={{
                      textAlign: 'right',
                      padding: '0 0 10px 12px',
                      fontSize: 11,
                      fontWeight: 500,
                      color: c.textMute,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      borderBottom: `1px solid ${c.border}`,
                    }}
                  >
                    Hits
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.map(({ rule, cells, hits }) => (
                  <tr key={rule.id}>
                    <th
                      scope="row"
                      style={{
                        textAlign: 'left',
                        padding: '11px 12px 11px 0',
                        borderBottom: `1px solid ${c.borderSoft}`,
                        fontWeight: 400,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: font.mono,
                          fontSize: 12,
                          fontWeight: 600,
                          color: rule.stops ? c.text : c.textSoft,
                        }}
                      >
                        {rule.id}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: c.textMute,
                          marginTop: 2,
                        }}
                      >
                        {rule.short}
                      </span>
                    </th>
                    {cells.map((v, i) => (
                      <td
                        key={i}
                        style={{
                          padding: '11px 6px',
                          borderBottom: `1px solid ${c.borderSoft}`,
                          textAlign: 'center',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: '100%',
                            maxWidth: 54,
                            height: 22,
                            borderRadius: 5,
                            background: verdictColor[v],
                          }}
                        />
                        <span className="sr-only">
                          {`${rule.id} on ${shipments[i].id}: ${VERDICT_WORD[v]}`}
                        </span>
                      </td>
                    ))}
                    <td
                      style={{
                        padding: '11px 0 11px 12px',
                        borderBottom: `1px solid ${c.borderSoft}`,
                        textAlign: 'right',
                        ...tnum,
                        fontWeight: 600,
                        color: hits === 0 ? c.textFaint : rule.stops ? c.fail : c.warn,
                      }}
                    >
                      {hits === 0 ? '—' : hits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>

            <Footnote>
              {naCells === 0
                ? 'Every rule could be tested against every booking.'
                : `${naCells} ${naCells === 1 ? 'cell reads' : 'cells read'} n/a: the rule does not apply to that booking, so it was never run. A grey cell is not a pass.`}
            </Footnote>
          </Card>
        </div>

        <div
          style={{
            flex: '1 1 320px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <Card>
            <CardHeader title="Which stage holds the book" />
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: c.textSoft }}>
              {worstStage
                ? `${worstStage.name} holds ${worstStage.count} of the ${heldTotal} held ${heldTotal === 1 ? 'booking' : 'bookings'}. That is where to put the effort.`
                : 'Nothing in the book is held at any stage.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {stageLoad.map((s) => {
                const fg = s.count === 0 ? c.neutral : s.count >= 2 ? c.fail : c.accent;
                return (
                  <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: c.textDim }}>{s.name}</span>
                      <span style={{ ...tnum, fontWeight: 600, color: fg }}>{s.count}</span>
                    </div>
                    <div
                      style={{
                        height: 7,
                        borderRadius: 4,
                        background: c.borderSoft,
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width: `${(s.count / maxStage) * 100}%`,
                          background: fg,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: c.textFaint }}>{s.owner}</span>
                  </div>
                );
              })}
            </div>
            <Footnote>
              {blockedCount} blocked {blockedCount === 1 ? 'booking' : 'bookings'}
              {heldStages === 0
                ? '.'
                : `, and ${heldTotal} held in total across ${heldStages} ${heldStages === 1 ? 'stage' : 'stages'}.`}
            </Footnote>
          </Card>

          <Card>
            <CardHeader title="Quiet rules" />
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: c.textSoft }}>
              {quiet.length === 0
                ? `Every one of the ${rules.length} fired at least once on this book. Nothing here is idle.`
                : `${quiet.length} of the ${rules.length} never fired on this book. They are not dead weight, they are the ones your sellers already get right.`}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {quiet.map((id) => (
                <span
                  key={id}
                  style={{
                    fontFamily: font.mono,
                    fontSize: 12,
                    padding: '5px 10px',
                    borderRadius: 7,
                    background: c.passBg,
                    color: c.pass,
                  }}
                >
                  {id}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="The rulebook" aside="Six stop a shipment, four cost time or money" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 12,
          }}
        >
          {rules.map((r) => {
            const edge = r.stops ? c.fail : c.warn;
            return (
              <div
                key={r.id}
                style={{
                  border: `1px solid ${c.border}`,
                  borderLeft: `3px solid ${edge}`,
                  borderRadius: 10,
                  padding: '15px 17px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  background: c.panel2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span
                    style={{
                      fontFamily: font.mono,
                      fontSize: 12,
                      fontWeight: 700,
                      color: edge,
                    }}
                  >
                    {r.id}
                  </span>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: 5,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      background: r.stops ? c.failBg : c.warnBg,
                      color: edge,
                    }}
                  >
                    {r.stops ? 'Stops it' : 'Costs you'}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{r.title}</span>
                <span style={{ fontSize: 12, lineHeight: 1.55, color: c.textMute }}>{r.why}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </Page>
  );
}
