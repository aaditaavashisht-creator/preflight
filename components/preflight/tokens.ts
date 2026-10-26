/**
 * Design tokens for the Pre-Flight dashboard screens.
 *
 * Matched by eye to the live app at preflight-three-mu.vercel.app:
 * near-black charcoal ground, clay/salmon accent, mint pass, coral fail.
 *
 * Every colour pair that has to be told apart also differs in lightness,
 * not hue alone, and every status colour is backed by a text label in the
 * markup — so the screens still read for anyone who cannot separate
 * red from green.
 */
export const c = {
  // Grounds
  bg: '#121318',
  panel: '#1B1D25',
  panel2: '#1F212A',
  raised: '#262933',
  control: '#2A2D36',

  // Lines
  border: '#2D3039',
  borderSoft: '#24262F',
  borderControl: '#3C404D',
  borderRaised: '#44485A',

  // Text — all of these clear 4.5:1 on `panel`
  text: '#F3F3F6',
  textDim: '#DCDDE3',
  textSoft: '#C6C8D1',
  textMute: '#A9ACB8',
  textFaint: '#878B98',

  // Accent (clay)
  accent: '#F0905F',
  accentHover: '#F7B38C',
  accentInk: '#1A1206',
  accentBg: '#3A2520',

  // Status
  fail: '#EF6A57',
  failBg: '#2A1C19',
  warn: '#D99A3B',
  warnBg: '#2A2416',
  pass: '#4FBF8F',
  passBg: '#1C3129',
  passCell: '#2F5E4C',
  neutral: '#6F7484',
  naCell: '#2A2D36',

  // Alert surface (the "Do not ship yet" band)
  alertBg: '#221512',
  alertBorder: '#4A2D26',
  alertInk: '#F07A62',
  alertText: '#D8C0B8',
  alertMute: '#A99790',
  alertTile: '#1A100D',
  alertTileBorder: '#44281F',
  alertChip: '#4A2018',
} as const;

export const font = {
  sans: 'Inter, system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/** Numerals that line up in columns. Use on every figure in a table. */
export const tnum = { fontVariantNumeric: 'tabular-nums' } as const;

/** Fill for a single rule cell in the strips and the matrix. */
export const verdictColor: Record<'pass' | 'fail' | 'warn' | 'na', string> = {
  pass: c.passCell,
  fail: c.fail,
  warn: c.warn,
  na: c.naCell,
};
