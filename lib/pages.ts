/** The app's screens, in the order a seller works them. Plain data, no React. */
export const PAGES = [
  { href: '/control-tower', label: 'Overview', blurb: 'The whole book at once' },
  { href: '/app', label: 'Shipment', blurb: 'One booking, in detail' },
  { href: '/exceptions', label: 'Exceptions', blurb: 'Every finding, worst money first' },
  { href: '/rules', label: 'Rules', blurb: 'Which checks actually bite' },
  { href: '/warehouse', label: 'Warehouse', blurb: 'The count, on a phone' },
] as const;
