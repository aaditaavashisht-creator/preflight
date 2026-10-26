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
import { rules, shipments, stageLoad } from './fixtures.data';

/**
 * Screen 3 — Rule and lane health.
 *
 * Every rule against every booking. The point of the matrix is the two
 * readings you cannot get from a per-shipment view: R-04 is the only rule
 * firing twice, and Paperwork clear holds half the blocked bookings.
 *
 * Static — no client state, so this can stay a server component.
 */

const blockedCount = shipments.filter((s) => s.blocked).length;

export default function RuleHealth() {
  // Each rule's row across the five bookings, in the order they are listed.
  const matrix = rules.map((rule, ruleIndex) => {
    const cells = shipments.map((s) => s.rules[ruleIndex]);
    const hits = cells.filter((v) => v === 'fail' || v === 'warn').length;
    return { rule, cells, hits };
  });

  // Rules that never fired on this book.
  const quiet = matrix.filter((m) => m.hits === 0).map((m) => m.rule.id);

  const maxStage = Math.max(...stageLoad.map((s) => s.count), 1);

  return (
    <Page>
      <PageHeader
        title="Rule and lane health"
        blurb="Ten rules against five bookings. Which checks actually bite, and which stage holds the book up."
      />

      <TileGrid>
        <StatTile label="Findings" value="11" note={`across ${rules.length * shipments.length} rule runs`} />
        <StatTile
          label="Stop a shipment"
          value="7"
          note="from the six red rules"
          valueColor={c.fail}
        />
        <StatTile
          label="Cost time or money"
          value="4"
          note="from the four amber rules"
          valueColor={c.warn}
        />
        <StatTile
          label="Fires most"
          value="R-04"
          note="the only rule to hit twice"
          valueColor={c.accent}
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

            <TableScroll min={580}>
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
              R-08 reads n/a on BK-104: it delivers to a business address, not a warehouse, so no
              slot is needed.
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
              Half the blocked bookings never get past paperwork. That is where to put the effort.
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
            <Footnote>{blockedCount} blocked bookings, spread across three stages.</Footnote>
          </Card>

          <Card>
            <CardHeader title="Quiet rules" />
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: c.textSoft }}>
              {quiet.length} of the ten never fired on this book. They are not dead weight, they
              are the ones your sellers already get right.
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
