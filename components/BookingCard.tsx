'use client';

import { fmtDate, gbp, kg, qty } from '@/lib/format';
import type { Booking, CheckResult } from '@/lib/types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="t-label">{label}</span>
      <span className="t-body">{children}</span>
    </div>
  );
}

function Inferred() {
  return <span className="t-label" style={{ marginLeft: 6 }}>derived from the item lines</span>;
}

export function BookingCard({ booking, result }: { booking: Booking; result: CheckResult }) {
  const route = [booking.originCity, booking.destCity].filter(Boolean).join(' to ') || 'Route not stated';
  return (
    <section className="card" aria-labelledby="booking-h">
      <div className="card-head">
        <h3 id="booking-h" className="t-section">Booking</h3>
        <span className="t-mono muted">{booking.id}</span>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}
      >
        <Row label="Seller">{booking.seller || <span className="muted">Not stated</span>}</Row>
        <Row label="Route">{route}</Row>
        <Row label="Destination type">
          {booking.destType || <span className="muted">Not stated</span>}
        </Row>
        <Row label="Ready to ship">
          {booking.readyDate ? fmtDate(booking.readyDate) : <span className="muted">Not stated</span>}
        </Row>
        <Row label="Priority">
          {booking.priority || <span className="muted">Balanced, by default</span>}
        </Row>
        <Row label="Appointment">
          {booking.appointment || <span className="muted">Not stated</span>}
        </Row>
        <Row label="Pallets">{qty(booking.pallets)}</Row>
        <Row label="Cartons">
          {qty(booking.cartons)}
          {booking.cartonsInferred && <Inferred />}
        </Row>
        <Row label="Declared value">
          {gbp(booking.declaredValue)}
          {booking.valueInferred && <Inferred />}
        </Row>
        <Row label="Gross weight">{kg(booking.grossWeight)}</Row>
        <Row label="Net weight of goods">
          {result.netWeight === null ? <span className="muted">No unit weights</span> : kg(result.netWeight, 1)}
        </Row>
        <Row label="Item lines come to">
          {result.computedValue === null ? <span className="muted">No prices</span> : gbp(result.computedValue)}
        </Row>
      </div>
    </section>
  );
}
