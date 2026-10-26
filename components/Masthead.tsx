'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSession } from '@/components/BookingsProvider';
import { PAGES } from '@/lib/pages';

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Masthead() {
  const { today, setToday, theme, setTheme, loaded, downloadCorrected, drawer, setDrawer } = useSession();
  /**
   * A static export is served at both /app and /app/, and the prerender and
   * the hydrated client can disagree about which. Comparing the trimmed form
   * keeps the markup identical either way.
   */
  const pathname = usePathname().replace(/\/+$/, '') || '/';
  const masthead = useRef<HTMLElement>(null);

  /**
   * A one-pixel sentinel at the top of the document rather than a scroll
   * listener: the observer fires twice in a session instead of on every frame,
   * and the header picks up its hairline the moment the page has moved.
   */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const mark = document.createElement('div');
    mark.setAttribute('aria-hidden', 'true');
    mark.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
    document.body.prepend(mark);
    const io = new IntersectionObserver(([entry]) => {
      document.body.classList.toggle('is-scrolled', !entry.isIntersecting);
    });
    io.observe(mark);
    return () => {
      io.disconnect();
      mark.remove();
      document.body.classList.remove('is-scrolled');
    };
  }, []);

  // The drawer belongs to /app, and its toggle only renders there. Leaving it
  // open and navigating away would strand a scrim nothing could dismiss.
  useEffect(() => {
    if (pathname !== '/app') setDrawer(false);
  }, [pathname, setDrawer]);

  // The masthead wraps on narrow screens, so the sticky columns have to learn
  // its real height rather than assume one.
  useEffect(() => {
    const el = masthead.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const sync = () => {
      document.documentElement.style.setProperty('--masthead-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header className="masthead" ref={masthead}>
      <div className="masthead-inner">
        {/* The drawer only exists on the one screen that has a queue beside it. */}
        {pathname === '/app' && (
          <button
            type="button"
            className="btn drawer-btn"
            aria-expanded={drawer}
            onClick={() => setDrawer((d) => !d)}
          >
            Shipments
          </button>
        )}

        <Link href="/app" className="masthead-brand" style={{ minWidth: 0 }}>
          <span className="brand-dot" aria-hidden="true" />
          <span style={{ minWidth: 0 }}>
            <p className="t-section" style={{ letterSpacing: '-.01em' }}>Pre-flight</p>
            <p className="t-label">Catch it before it ships, not after it is stuck</p>
          </span>
        </Link>

        <div className="masthead-tools">
          <label className="t-label" style={{ color: 'inherit', opacity: .85 }} htmlFor="today">
            Treat today as
          </label>
          {/* Tabbing into a date field focuses a segment inside its shadow
              tree, so the ring has to live on a wrapper that can see it. */}
          <span className="date-wrap">
            <input
              id="today"
              type="date"
              className="input"
              value={isoDate(today)}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [y, m, d] = v.split('-').map(Number);
                setToday(new Date(y, m - 1, d));
              }}
            />
          </span>
          <button type="button" className="btn" onClick={downloadCorrected} disabled={!loaded}>
            Download corrected sheet
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Switch between light and dark"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      <nav className="nav" aria-label="Screens">
        <ul>
          {PAGES.map((p) => {
            const here = pathname === p.href;
            return (
              <li key={p.href}>
                <Link href={p.href} aria-current={here ? 'page' : undefined} title={p.blurb}>
                  {p.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
