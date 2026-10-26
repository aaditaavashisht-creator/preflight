'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSession } from '@/components/BookingsProvider';
import { NothingLoaded } from '@/components/NothingLoaded';
import WarehouseCheck from '@/components/preflight/WarehouseCheck';
import { toCountTask } from '@/lib/dashboard';

export default function Page() {
  const { entries, loaded } = useSession();
  const task = useMemo(() => toCountTask(entries), [entries]);

  if (!loaded) return <NothingLoaded what="The warehouse check" />;

  /* The screen is one job. With no carton count in dispute there is no job. */
  if (!task) {
    return (
      <div className="nothing">
        <div className="card empty">
          <h2 className="t-section">No count to settle</h2>
          <p className="t-body prose" style={{ marginTop: 8 }}>
            This screen is for one job: a booking whose carton total does not match its item lines.
            Nothing in the book has one right now, so there is nothing for the warehouse to count.
          </p>
          <div className="empty-actions">
            <Link className="btn" href="/exceptions">See what is firing instead</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-frame">
      <p className="t-small muted prose" style={{ textAlign: 'center', maxWidth: 440 }}>
        One job, sized for the person actually counting. Step the number to what is on the pallet
        and the carton rule settles there and then.
      </p>
      <div className="phone-shell">
        <WarehouseCheck task={task} />
      </div>
    </div>
  );
}
