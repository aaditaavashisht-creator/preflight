import { c, font, tnum } from './tokens';
import { Card, CardHeader, Footnote, Page, TableScroll, Td, Th } from './ui';
import { bk102 } from './fixtures.data';

/**
 * Screen 4 — Shipment detail, reworked.
 *
 * The screen you already have, restructured:
 *  - readiness becomes a horizontal rail instead of a vertical list, so the
 *    held stage reads at a glance
 *  - findings become prioritised cards with the fix inline, worst money first
 *  - the carrier weights become real sliders, since "balanced" is a judgement
 *  - the two disputed figures are picked out in the items table
 *
 * Static apart from the sliders, which are uncontrolled inputs here — wire
 * them to state when you hook up live re-ranking.
 */

export default function ShipmentDetail() {
  const s = bk102;

  return (
    <Page>
      {/* Verdict band */}
      <section
        style={{
          background: c.alertBg,
          border: `1px solid ${c.alertBorder}`,
          borderRadius: 16,
          padding: '26px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 18,
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 700,
                color: c.alertInk,
                letterSpacing: '-0.02em',
              }}
            >
              Do not ship yet
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.55,
                color: c.alertText,
                maxWidth: 620,
              }}
            >
              Three things on {s.lane} will stop the shipment or hold it at the border. One more
              will cost you money after it moves.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              <span
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: c.alertChip,
                  color: c.alertInk,
                }}
              >
                {s.blocking} blocking issues
              </span>
              <span
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#3A3016',
                  color: '#E5B457',
                }}
              >
                {s.watching} to watch
              </span>
            </div>
          </div>
          <div
            style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            <span style={{ fontFamily: font.mono, fontSize: 18, fontWeight: 700 }}>{s.id}</span>
            <span style={{ fontSize: 14, color: '#C9B3AC' }}>{s.seller}</span>
            <span style={{ fontSize: 13, color: c.alertMute }}>{s.lane}</span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12,
          }}
        >
          {s.stats.map((stat, i) => (
            <div
              key={stat.label}
              style={{
                background: c.alertTile,
                border: `1px solid ${c.alertTileBorder}`,
                borderRadius: 12,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 27,
                  fontWeight: 700,
                  color: i === 0 ? c.alertInk : c.text,
                  ...tnum,
                }}
              >
                {stat.value}
              </span>
              <span style={{ fontSize: 12, color: c.alertMute }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Readiness rail */}
      <Card>
        <CardHeader
          title="Readiness"
          aside="Held at paperwork clear — seller, or their customs broker"
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {s.stages.map((stage) => (
            <div
              key={stage.name}
              style={{
                flex: '1 1 200px',
                minWidth: 0,
                border: `1px solid ${stage.clear ? c.border : c.alertBorder}`,
                background: stage.clear ? c.panel2 : '#231713',
                borderRadius: 11,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
              }}
            >
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: stage.clear ? c.pass : c.fail,
                }}
              />
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{stage.name}</span>
                {stage.held ? (
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: 5,
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background: c.alertChip,
                      color: c.alertInk,
                    }}
                  >
                    held here
                  </span>
                ) : null}
              </div>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: c.textMute }}>
                {stage.detail}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
        {/* Findings */}
        <section
          style={{
            flex: '999 1 600px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              What to fix, worst money first
            </h2>
            <span style={{ fontSize: 12, color: c.textMute }}>
              4 of ten rules have something to say
            </span>
          </div>

          {s.findings.map((f) => {
            const edge = f.stops ? c.fail : c.warn;
            return (
              <article
                key={f.rule}
                style={{
                  background: c.panel,
                  border: `1px solid ${c.border}`,
                  borderLeft: `3px solid ${edge}`,
                  borderRadius: 12,
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 600,
                      lineHeight: 1.35,
                      flex: '1 1 320px',
                    }}
                  >
                    {f.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, ...tnum, color: edge }}>
                      {f.risk}
                    </span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: f.stops ? c.failBg : c.warnBg,
                        color: edge,
                      }}
                    >
                      {f.rule}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                    gap: 1,
                    background: c.border,
                    border: `1px solid ${c.border}`,
                    borderRadius: 10,
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
                        padding: '13px 15px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: c.textMute,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {cell.k}
                      </span>
                      <span style={{ fontSize: 13, lineHeight: 1.5 }}>{cell.v}</span>
                    </div>
                  ))}
                </div>

                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: c.textSoft }}>
                  {f.diagnosis}
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
                  >
                    <button
                      type="button"
                      style={{
                        minHeight: 44,
                        padding: '0 18px',
                        borderRadius: 10,
                        background: f.primary ? c.accent : c.control,
                        border: `1px solid ${f.primary ? c.accent : c.borderControl}`,
                        color: f.primary ? c.accentInk : c.textDim,
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      {f.fix}
                    </button>
                    <span style={{ fontSize: 12, color: c.textMute }}>{f.fixNote}</span>
                  </div>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 12,
                      fontWeight: 500,
                      color: f.high ? c.pass : c.warn,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: f.high ? c.pass : c.warn,
                      }}
                    />
                    {f.confidence}
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        {/* Carrier + gate */}
        <section
          style={{
            flex: '1 1 330px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <Card>
            <CardHeader title="Carrier" aside="Balanced · 2 pallets" />
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: c.textSoft }}>
              Carrier B road standard at £400 wins on balanced. Carrier C is £240 more for one day
              less.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {s.carriers.map((car) => (
                <div
                  key={car.name}
                  style={{
                    border: `1px solid ${car.best ? '#2C4A3C' : c.border}`,
                    background: car.best ? '#16271F' : c.panel2,
                    borderRadius: 10,
                    padding: '13px 15px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{car.name}</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        ...tnum,
                        color: car.best ? c.pass : c.textMute,
                      }}
                    >
                      {car.total}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 14,
                      flexWrap: 'wrap',
                      fontSize: 11,
                      color: c.textMute,
                    }}
                  >
                    <span>{car.transit}</span>
                    <span>{car.onTime} on time</span>
                    <span>{car.perPallet} a pallet</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 3,
                        background: c.borderSoft,
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width: `${car.score * 100}%`,
                          background: car.best ? c.pass : c.textMute,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        ...tnum,
                        color: c.textMute,
                        width: 30,
                        textAlign: 'right',
                      }}
                    >
                      {car.score.toFixed(2)}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: car.best ? c.pass : c.textMute }}>
                    {car.why}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                borderTop: `1px solid ${c.border}`,
                paddingTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: c.textMute,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Weights
              </span>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: c.textMute }}>
                Balanced is a judgement call. Move these and the ranking changes.
              </p>
              {s.weights.map((w) => (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <label htmlFor={w.id} style={{ fontSize: 12, color: c.textDim, width: 72 }}>
                    {w.name}
                  </label>
                  <input
                    id={w.id}
                    type="range"
                    min={0}
                    max={100}
                    defaultValue={w.value}
                    style={{ flex: 1, minWidth: 0, accentColor: c.accent, height: 22 }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      ...tnum,
                      color: c.textMute,
                      width: 32,
                      textAlign: 'right',
                    }}
                  >
                    {(w.value / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card accentBorder={c.alertBorder}>
            <CardHeader title="Before this can be booked" />
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: c.textSoft }}>
              There is no confirmation to give yet. {s.id} will be held, refused or short-received
              as it stands.
            </p>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {s.gate.map((g, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      flex: 'none',
                      width: 16,
                      height: 16,
                      marginTop: 2,
                      borderRadius: 4,
                      border: '1.5px solid #6B4238',
                    }}
                  />
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: c.textDim }}>{g}</span>
                </li>
              ))}
            </ul>
            <Footnote>
              Clear these and the carrier recommendation and the confirmation appear here.
            </Footnote>
          </Card>
        </section>
      </div>

      {/* Items */}
      <Card>
        <CardHeader title="Items" aside="2 lines · the rows the rules are reading" />
        <TableScroll min={660}>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Description</Th>
              <Th>HS code</Th>
              <Th align="right">Quantity</Th>
              <Th align="right">Unit price</Th>
              <Th align="right">Cartons</Th>
              <Th>Origin</Th>
            </tr>
          </thead>
          <tbody>
            {s.items.map((it) => (
              <tr key={it.sku}>
                <Td style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 600 }}>{it.sku}</Td>
                <Td style={{ color: c.textDim }}>{it.desc}</Td>
                <Td style={{ fontFamily: font.mono, fontSize: 12, color: c.textDim }}>{it.hs}</Td>
                <Td align="right" style={tnum}>
                  {it.qty}
                </Td>
                <Td
                  align="right"
                  style={{
                    ...tnum,
                    color: it.flagPrice ? c.accent : c.textDim,
                    fontWeight: it.flagPrice ? 700 : 400,
                  }}
                >
                  {it.price}
                </Td>
                <Td
                  align="right"
                  style={{
                    ...tnum,
                    color: it.flagCartons ? c.accent : c.textDim,
                    fontWeight: it.flagCartons ? 700 : 400,
                  }}
                >
                  {it.cartons}
                </Td>
                <Td style={{ color: c.textDim }}>{it.origin}</Td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
        <Footnote>The two figures the rules are arguing with are picked out in orange.</Footnote>
      </Card>
    </Page>
  );
}
