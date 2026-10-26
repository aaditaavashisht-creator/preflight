'use client';

import { addWorkingDays, fmtDateLong, gbp } from '@/lib/format';
import { serviceName } from '@/lib/carriers';
import type { Booking, CheckResult } from '@/lib/types';

export function Confirmation({
  booking, result, today,
}: {
  booking: Booking; result: CheckResult; today: Date;
}) {
  if (result.verdict === 'Red') return <BeforeYouBook booking={booking} result={result} />;

  const rec = result.recommendation;
  const win = rec.winner;
  const ready = booking.readyDate ?? today;
  const arrival = win ? addWorkingDays(ready, win.row.days) : null;

  return (
    <section className="card" aria-labelledby="next-h">
      <div className="card-head">
        <h3 id="next-h" className="t-section">What happens next</h3>
        {result.verdict === 'Amber' && (
          <span className="t-small muted">With {result.amberCount} thing{result.amberCount === 1 ? '' : 's'} still worth clearing</span>
        )}
      </div>

      <ol className="steps">
        <Step>
          Book <strong>{win ? serviceName(win.row) : 'a carrier'}</strong>
          {win && <> at {gbp(win.cost)} for {booking.pallets} pallet{booking.pallets === 1 ? '' : 's'}</>}
          {booking.destCity && <>, {booking.originCity || 'UK'} to {booking.destCity}</>}.
        </Step>
        <Step>
          Send your broker the commercial invoice and packing list showing{' '}
          {gbp(booking.declaredValue)} across {booking.cartons} cartons. The commodity codes on the
          item lines are what the entry is filed on.
        </Step>
        {booking.destType === 'Warehouse' ? (
          <Step>
            {booking.appointment === 'Yes'
              ? 'Confirm the booked delivery slot against the transit time below, and move it if the dates no longer line up.'
              : 'Book the delivery slot at the receiving warehouse. Slots run three to five working days out.'}
          </Step>
        ) : (
          <Step>
            Confirm someone can take the delivery at the business address, and that there is a
            forklift or a tail lift for {booking.pallets} pallet{booking.pallets === 1 ? '' : 's'}.
          </Step>
        )}
        <Step>
          Have the goods palletised, wrapped and labelled by{' '}
          <strong>{fmtDateLong(ready)}</strong>, the ready date on this booking.
        </Step>
        {arrival && win && (
          <Step>
            Expect delivery around <strong>{fmtDateLong(arrival)}</strong>, {win.row.days} working
            days in transit. {serviceName(win.row)} runs at {win.row.onTime}% on time, so build a
            little slack into anything that depends on the stock landing.
          </Step>
        )}
      </ol>

      {result.amberCount > 0 && (
        <p className="t-small muted prose" style={{ marginTop: 14 }}>
          The {result.amberCount} amber {result.amberCount === 1 ? 'item' : 'items'} above
          {result.amberCount === 1 ? ' does' : ' do'} not stop the booking, but
          {result.amberCount === 1 ? ' it is' : ' they are'} the usual cause of a shipment arriving
          late or costing more than quoted.
        </p>
      )}
    </section>
  );
}

function BeforeYouBook({ booking, result }: { booking: Booking; result: CheckResult }) {
  const reds = result.issues.filter((i) => i.severity === 'Red');
  return (
    <section className="card" aria-labelledby="next-h">
      <div className="card-head">
        <h3 id="next-h" className="t-section">Before this can be booked</h3>
        <span className="t-small muted">{reds.length} blocking {reds.length === 1 ? 'item' : 'items'}</span>
      </div>

      <p className="t-body prose" style={{ marginBottom: 14 }}>
        There is no confirmation to give yet. {booking.id} will be held, refused or short-received
        as it stands. These have to clear first.
      </p>

      <ol className="steps">
        {reds.map((i) => (
          <Step key={`${i.rule}-${i.sku ?? ''}`}>
            <strong>{i.title}.</strong>{' '}
            {i.fix
              ? <>Apply <em>{i.fix.label}</em> above, or make the same change in your own sheet.</>
              : 'This one needs a number only you can confirm. It cannot be fixed from here.'}
          </Step>
        ))}
      </ol>

      <p className="t-small muted prose" style={{ marginTop: 14 }}>
        Clear these and the carrier recommendation and the confirmation appear here.
      </p>
    </section>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="step">
      <span className="step-n" aria-hidden="true" />
      <span className="t-body" style={{ minWidth: 0 }}>{children}</span>
    </li>
  );
}
