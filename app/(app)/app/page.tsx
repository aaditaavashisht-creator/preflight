import type { Metadata } from 'next';
import { Workspace } from '@/components/Workspace';

export const metadata: Metadata = {
  title: 'Check a shipment — Pre-Flight',
  description: 'Check one booking against the ten rules, see what is wrong and what to put there instead, and pick a carrier it can travel on.',
};

export default function Page() {
  return <Workspace />;
}
