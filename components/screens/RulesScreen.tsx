'use client';

import { useMemo } from 'react';
import { useSession } from '@/components/BookingsProvider';
import { NothingLoaded } from '@/components/NothingLoaded';
import RuleHealth from '@/components/preflight/RuleHealth';
import { RULE_CARDS, toFindings, toStageLoad } from '@/lib/dashboard';

export function RulesScreen() {
  const { entries, book, loaded } = useSession();
  const findings = useMemo(() => toFindings(entries), [entries]);
  const stageLoad = useMemo(() => toStageLoad(entries), [entries]);

  if (!loaded) return <NothingLoaded what="The rule matrix" />;

  return (
    <RuleHealth
      shipments={book.shipments}
      rules={RULE_CARDS}
      stageLoad={stageLoad}
      findings={findings}
    />
  );
}
