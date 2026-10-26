'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/components/BookingsProvider';
import { NothingLoaded } from '@/components/NothingLoaded';
import ControlTower from '@/components/preflight/ControlTower';

export function ControlTowerScreen() {
  const { book, loaded, select } = useSession();
  const router = useRouter();

  if (!loaded) return <NothingLoaded what="The control tower" />;

  return (
    <ControlTower
      book={book}
      onOpen={(id) => { select(id); router.push('/app'); }}
      onQueue={() => router.push('/exceptions')}
    />
  );
}
