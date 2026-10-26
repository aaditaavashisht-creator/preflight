'use client';

import { gbpExact, qty } from '@/lib/format';
import type { Booking, Issue } from '@/lib/types';

/** Flags the skus the rulebook has something to say about. */
function flaggedSkus(issues: Issue[]): Map<string, 'Red' | 'Amber'> {
  const out = new Map<string, 'Red' | 'Amber'>();
  for (const i of issues) {
    if (!i.sku) continue;
    if (i.severity === 'Red' || !out.has(i.sku)) out.set(i.sku, i.severity);
  }
  return out;
}

export function ItemsTable({ booking, issues }: { booking: Booking; issues: Issue[] }) {
  const flagged = flaggedSkus(issues);

  if (booking.items.length === 0) {
    return (
      <section className="card" aria-labelledby="items-h">
        <div className="card-head"><h3 id="items-h" className="t-section">Items</h3></div>
        <p className="t-small muted">
          No item lines yet. Without them the item level rules cannot run, so the checks below are
          only part of the picture.
        </p>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="items-h">
      <div className="card-head">
        <h3 id="items-h" className="t-section">Items</h3>
        <span className="t-small muted">
          {booking.items.length} {booking.items.length === 1 ? 'line' : 'lines'}
        </span>
      </div>

      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col">Description</th>
              <th scope="col">HS code</th>
              <th scope="col" className="num">Quantity</th>
              <th scope="col" className="num">Unit price</th>
              <th scope="col" className="num">Per carton</th>
              <th scope="col" className="num">Cartons</th>
              <th scope="col" className="num">Unit kg</th>
              <th scope="col">Origin</th>
            </tr>
          </thead>
          <tbody>
            {booking.items.map((i) => {
              const sev = flagged.get(i.sku);
              return (
                <tr key={i.sku}>
                  <td>
                    <span className="t-mono">{i.sku}</span>
                    {sev && (
                      <span
                        className="dot"
                        style={{ display: 'inline-block', marginLeft: 6, background: sev === 'Red' ? 'var(--red)' : 'var(--amber)' }}
                        title={`${i.sku} is named in a ${sev === 'Red' ? 'blocking' : 'caution'} issue below`}
                      />
                    )}
                  </td>
                  <td style={{ minWidth: 180 }}>{i.description || <span className="muted">No description</span>}</td>
                  <td><span className="t-mono">{i.hsCode || <span className="muted">blank</span>}</span></td>
                  <td className="num">{qty(i.quantity)}</td>
                  <td className="num">{i.unitPrice === null ? '—' : gbpExact(i.unitPrice)}</td>
                  <td className="num">{qty(i.unitsPerCarton)}</td>
                  <td className="num">{qty(i.cartons)}</td>
                  <td className="num">{i.unitWeight === null ? '—' : i.unitWeight}</td>
                  <td>{i.countryOfOrigin || <span className="muted">blank</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
