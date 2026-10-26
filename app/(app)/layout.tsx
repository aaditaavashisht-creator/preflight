'use client';

import { BookingsProvider } from '@/components/BookingsProvider';
import { Masthead } from '@/components/Masthead';

/**
 * Every app screen shares this layout, which is what keeps the loaded
 * bookings alive while you move between them. Nothing is stored, so a full
 * reload starts over — that is the privacy promise, not an oversight.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingsProvider>
      <div className="shell">
        <a className="skip-link" href="#content">Skip to the content</a>
        <Masthead />
        {children}
      </div>
    </BookingsProvider>
  );
}
