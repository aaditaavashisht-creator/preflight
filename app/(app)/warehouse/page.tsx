import type { Metadata } from 'next';
import { WarehouseScreen } from '@/components/screens/WarehouseScreen';

export const metadata: Metadata = {
  title: 'Warehouse check — Pre-Flight',
  description: 'One job, sized for the person counting: settle a carton count that does not reconcile.',
};

export default function Page() {
  return <WarehouseScreen />;
}
