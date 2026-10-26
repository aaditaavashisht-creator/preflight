'use client';

/**
 * Landing page.
 *
 * The animation is the product: ten rules sweep across a booking, eight pass,
 * one costs money, one stops the shipment. It loops on a 7s cycle.
 *
 * Verified in a browser at 1280x900 (fits with no scroll) and at 375px
 * (no horizontal scroll, buttons go full width).
 *
 * All CSS is scoped under `.pf-landing` so it cannot leak into your app's
 * global styles. Keyframes have to live in a stylesheet rather than inline,
 * hence the single <style> element.
 */

const PASS = '#4FBF8F';
const WARN = '#D99A3B';
const FAIL = '#EF6A57';

/** Verdict per rule, R-01 to R-10. This is BK-101 from the demo set. */
const CELLS: string[] = [
  PASS, PASS, PASS, FAIL, PASS, PASS, PASS, WARN, PASS, PASS,
];

const css = `
.pf-landing {
  --bg: #121318;
  --border: #2D3039;
  --dim: #2A2D36;
  --text: #F3F3F6;
  --soft: #C6C8D1;
  --mute: #A9ACB8;
  --faint: #878B98;
  --accent: #F0905F;
  --accent-ink: #1A1206;

  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.pf-landing *, .pf-landing *::before, .pf-landing *::after { box-sizing: border-box; }

.pf-bg-lines, .pf-bg-glow { position: absolute; inset: 0; pointer-events: none; }

.pf-bg-lines {
  background-image: repeating-linear-gradient(
    115deg, transparent 0 38px, rgba(255,255,255,0.022) 38px 39px
  );
  animation: pf-drift 26s linear infinite;
}

.pf-bg-glow {
  background: radial-gradient(
    46% 38% at 50% 26%,
    rgba(240,144,95,0.14) 0%, rgba(240,144,95,0.05) 42%, transparent 72%
  );
  animation: pf-breathe 11s ease-in-out infinite;
}

@keyframes pf-drift { from { transform: translateX(0); } to { transform: translateX(-78px); } }
@keyframes pf-breathe { 0%,100% { opacity: .72; } 50% { opacity: 1; } }

.pf-landing nav {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 22px 32px; flex-wrap: wrap;
}

.pf-mark { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.pf-mark-dot { width: 10px; height: 10px; border-radius: 3px; background: var(--accent); animation: pf-blip 3.2s ease-in-out infinite; }
@keyframes pf-blip { 0%,82%,100% { opacity: 1; transform: scale(1); } 88% { opacity: .45; transform: scale(.82); } }

.pf-nav-links { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pf-nav-link {
  min-height: 44px; display: inline-flex; align-items: center; padding: 0 14px;
  border-radius: 9px; color: var(--soft); font-size: 14px; text-decoration: none;
}
.pf-nav-link:hover { color: var(--text); background: rgba(255,255,255,0.05); }

.pf-landing main {
  position: relative; z-index: 2; flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 40px 24px 48px; gap: 22px;
}

.pf-eyebrow {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 7px 15px 7px 11px; border: 1px solid var(--border);
  background: rgba(27,29,37,0.7); border-radius: 999px;
  font-size: 12.5px; font-weight: 500; color: var(--mute);
}
.pf-eyebrow b { color: var(--accent); font-weight: 600; white-space: nowrap; }

.pf-landing h1 {
  margin: 0; font-size: clamp(40px, 7.2vw, 84px); line-height: 1.02;
  font-weight: 800; letter-spacing: -0.035em; max-width: 14ch;
}
.pf-landing h1 .pf-line { display: block; }
.pf-landing h1 .pf-clay { color: var(--accent); }

.pf-sub {
  margin: 0; max-width: 54ch; font-size: clamp(15px, 1.8vw, 18px);
  line-height: 1.6; color: var(--mute);
}

.pf-check {
  width: min(560px, 100%); border: 1px solid var(--border);
  background: rgba(27,29,37,0.74); border-radius: 16px; padding: 22px 24px;
  display: flex; flex-direction: column; gap: 14px;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}

.pf-check-top {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 6px 12px; flex-wrap: wrap; font-size: 12px;
}
.pf-check-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; color: var(--soft); }
.pf-check-note { color: var(--faint); white-space: nowrap; }

.pf-strip { position: relative; display: flex; gap: 5px; }

.pf-cell {
  flex: 1; height: 26px; border-radius: 5px; background: var(--dim);
  transform-origin: center bottom;
  animation: pf-cell 7s cubic-bezier(.22,1,.36,1) infinite both;
}

@keyframes pf-cell {
  0%        { background: var(--dim); transform: scaleY(.45); opacity: .45; }
  5%        { transform: scaleY(1.22); opacity: 1; }
  9%        { background: var(--v); transform: scaleY(1); }
  76%       { background: var(--v); opacity: 1; }
  88%,100%  { background: var(--dim); opacity: .45; transform: scaleY(.45); }
}

.pf-sweep {
  position: absolute; top: -5px; bottom: -5px; width: 46px; border-radius: 10px;
  background: linear-gradient(90deg, transparent, rgba(240,144,95,.3), transparent);
  animation: pf-sweep 7s cubic-bezier(.4,0,.2,1) infinite;
}
@keyframes pf-sweep {
  0%       { left: -46px; opacity: 0; }
  4%       { opacity: 1; }
  22%      { left: 100%; opacity: 1; }
  28%,100% { left: 100%; opacity: 0; }
}

.pf-verdict { display: flex; align-items: center; gap: 9px; font-size: 13.5px; line-height: 1.5; color: var(--soft); text-align: left; margin: 0; }
.pf-verdict-dot { width: 8px; height: 8px; border-radius: 50%; background: ${FAIL}; flex: none; }
.pf-verdict b { color: var(--text); font-weight: 600; }

.pf-cta-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: center; }

.pf-start {
  position: relative; min-height: 56px; padding: 0 40px; border: none; border-radius: 13px;
  background: var(--accent); color: var(--accent-ink); font-family: inherit;
  font-size: 17px; font-weight: 700; letter-spacing: -0.01em; cursor: pointer;
  display: inline-flex; align-items: center; gap: 11px; text-decoration: none;
  animation: pf-halo 3.4s ease-in-out infinite;
  transition: transform 140ms ease, background 140ms ease;
}
.pf-start:hover { transform: translateY(-2px); background: #F7A478; }
.pf-start:active { transform: translateY(0); }
.pf-start:focus-visible { outline: 3px solid #F7B38C; outline-offset: 3px; }
.pf-start svg { transition: transform 160ms ease; }
.pf-start:hover svg { transform: translateX(3px); }

@keyframes pf-halo {
  0%,100% { box-shadow: 0 0 0 0 rgba(240,144,95,.36), 0 10px 30px -12px rgba(240,144,95,.5); }
  50%     { box-shadow: 0 0 0 14px rgba(240,144,95,0), 0 10px 30px -12px rgba(240,144,95,.5); }
}

.pf-secondary {
  min-height: 56px; display: inline-flex; align-items: center; padding: 0 22px;
  border-radius: 13px; border: 1px solid var(--border); background: transparent;
  color: var(--soft); font-family: inherit; font-size: 15px; font-weight: 500;
  cursor: pointer; text-decoration: none;
}
.pf-secondary:hover { color: var(--text); border-color: #43485A; }

.pf-reassure { margin: 0; font-size: 12.5px; color: var(--faint); }

.pf-rise { animation: pf-rise 760ms cubic-bezier(.22,1,.36,1) both; }
.pf-d1 { animation-delay: 60ms; }
.pf-d2 { animation-delay: 150ms; }
.pf-d3 { animation-delay: 240ms; }
.pf-d4 { animation-delay: 340ms; }
.pf-d5 { animation-delay: 440ms; }
.pf-d6 { animation-delay: 540ms; }

@keyframes pf-rise {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.pf-landing footer {
  position: relative; z-index: 2; padding: 0 32px 28px;
  text-align: center; font-size: 12px; color: var(--faint);
}

@media (max-width: 560px) {
  .pf-landing nav { padding: 18px 20px; }
  .pf-landing main { padding: 32px 20px 56px; gap: 22px; }
  .pf-check { padding: 18px; }
  .pf-cell { height: 22px; }
  .pf-start, .pf-secondary { width: 100%; justify-content: center; }
}

/* Anyone who asked for less motion gets the finished state, not the show. */
@media (prefers-reduced-motion: reduce) {
  .pf-bg-lines, .pf-bg-glow, .pf-mark-dot, .pf-sweep, .pf-start { animation: none; }
  .pf-rise { animation: none; opacity: 1; transform: none; }
  .pf-cell { animation: none; background: var(--v); opacity: 1; transform: none; }
}
`;

export interface LandingProps {
  /** Where Start goes. Default '/app'. */
  startHref?: string;
  /** Use instead of startHref to handle Start in JS. */
  onStart?: () => void;
}

export default function Landing({ startHref = '/app', onStart }: LandingProps) {
  const startContent = (
    <>
      Start
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </>
  );

  return (
    <div className="pf-landing">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="pf-bg-lines" aria-hidden="true" />
      <div className="pf-bg-glow" aria-hidden="true" />

      <nav>
        <span className="pf-mark pf-rise pf-d1">
          <span className="pf-mark-dot" aria-hidden="true" />
          Pre-Flight
        </span>
        <span className="pf-nav-links pf-rise pf-d1">
          <a className="pf-nav-link" href="#how">
            How it works
          </a>
          <a className="pf-nav-link" href="#rules">
            The ten rules
          </a>
          <a className="pf-nav-link" href="#start">
            Sign in
          </a>
        </span>
      </nav>

      <main>
        <span className="pf-eyebrow pf-rise pf-d1">
          <b>Ten rules</b> · six stop a shipment, four cost you money
        </span>

        <h1 className="pf-rise pf-d2">
          <span className="pf-line">Catch it before</span>
          <span className="pf-line pf-clay">it ships.</span>
        </h1>

        <p className="pf-sub pf-rise pf-d3">
          Drop in a booking sheet and every row is checked against the same ten rules that hold
          shipments at a border or short-receive them at a warehouse. Each failure says which field
          is wrong and what to put there instead.
        </p>

        <div className="pf-check pf-rise pf-d4">
          <div className="pf-check-top">
            <span className="pf-check-id">BK-101 · Manchester to Frankfurt</span>
            <span className="pf-check-note">R-01 to R-10</span>
          </div>
          <div className="pf-strip">
            {CELLS.map((v, i) => (
              <span
                key={i}
                className="pf-cell"
                style={
                  { '--v': v, animationDelay: `${i * 70}ms` } as React.CSSProperties
                }
              />
            ))}
            <span className="pf-sweep" aria-hidden="true" />
          </div>
          <p className="pf-verdict">
            <span className="pf-verdict-dot" aria-hidden="true" />
            <span>
              <b>R-04 will stop this one.</b> The booking says 90 cartons, the item lines add up to
              96. About £1,080 at risk.
            </span>
          </p>
        </div>

        <div className="pf-cta-row pf-rise pf-d5">
          {onStart ? (
            <button type="button" className="pf-start" onClick={onStart}>
              {startContent}
            </button>
          ) : (
            <a className="pf-start" href={startHref}>
              {startContent}
            </a>
          )}
          <a className="pf-secondary" href="#how">
            See a worked example
          </a>
        </div>

        <p className="pf-reassure pf-rise pf-d6">
          Runs entirely in your browser. Nothing is uploaded, stored or sent anywhere.
        </p>
      </main>

      <footer>Pre-Flight · catch it before it ships, not after it is stuck</footer>
    </div>
  );
}
