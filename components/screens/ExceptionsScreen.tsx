'use client';

import { useMemo } from 'react';
import { useSession } from '@/components/BookingsProvider';
import { NothingLoaded } from '@/components/NothingLoaded';
import ExceptionQueue from '@/components/preflight/ExceptionQueue';
import { toFindings, toQueueStats } from '@/lib/dashboard';

export function ExceptionsScreen() {
  const { entries, book, loaded, downloadCorrected, applyAllAcrossBook } = useSession();
  const findings = useMemo(() => toFindings(entries), [entries]);
  const stats = useMemo(() => toQueueStats(findings, book.shipments), [findings, book.shipments]);

  if (!loaded) return <NothingLoaded what="The exception queue" />;

  return (
    <ExceptionQueue
      findings={findings}
      shipments={book.shipments}
      stats={stats}
      onDownload={downloadCorrected}
      onApplyAll={applyAllAcrossBook}
    />
  );
}
