import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pre-Flight — catch it before it ships',
  description:
    'Checks a UK to EU shipment against ten customs and freight rules before it leaves, ' +
    'names the field that is wrong, and recommends a carrier it can actually travel on.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E8531F' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1014' },
  ],
};

/** Applied before paint so a chosen theme does not flash the other one. */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('preflight-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
