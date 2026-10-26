import type { Metadata } from 'next';
import { RulesScreen } from '@/components/screens/RulesScreen';

export const metadata: Metadata = {
  title: 'Rule and lane health — Pre-Flight',
  description: 'Every rule against every booking: which checks actually bite, and which stage is holding the book up.',
};

export default function Page() {
  return <RulesScreen />;
}
