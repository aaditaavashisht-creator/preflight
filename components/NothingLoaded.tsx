'use client';

import Link from 'next/link';
import { useSession } from '@/components/BookingsProvider';

/** Every portfolio screen is empty until a book is loaded. Say so, and offer the way out. */
export function NothingLoaded({ what }: { what: string }) {
  const { loadDemo } = useSession();
  return (
    <div className="nothing">
      <div className="card empty">
        <h2 className="t-section">Nothing is loaded yet</h2>
        <p className="t-body prose" style={{ marginTop: 8 }}>
          {what} needs bookings to read. Load the demo set, or open a shipment and drop your own
          Bookings and Items spreadsheet on it.
        </p>
        <div className="empty-actions">
          <button type="button" className="btn btn-primary" onClick={loadDemo}>Load the demo set</button>
          <Link className="btn" href="/app">Open a shipment</Link>
        </div>
      </div>
    </div>
  );
}
