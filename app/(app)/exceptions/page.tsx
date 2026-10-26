import type { Metadata } from 'next';
import { ExceptionsScreen } from '@/components/screens/ExceptionsScreen';

export const metadata: Metadata = {
  title: 'Exception queue — Pre-Flight',
  description: 'Every finding across the book, blockers first and worst money first, with the field that is wrong and what to put there instead.',
};

export default function Page() {
  return <ExceptionsScreen />;
}
