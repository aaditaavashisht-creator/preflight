import type { Metadata } from 'next';
import { ControlTowerScreen } from '@/components/screens/ControlTowerScreen';

export const metadata: Metadata = {
  title: 'Control tower — Pre-Flight',
  description: 'Every loaded booking at once: what is blocked, what it is costing, and which stage is holding it.',
};

export default function Page() {
  return <ControlTowerScreen />;
}
