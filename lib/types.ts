/**
 * The one booking object. The typed conversation and the uploaded spreadsheet
 * both populate this shape and both run the same engine.
 */

export type Priority = 'Cheapest' | 'Fastest' | 'Most reliable' | 'Balanced';
export type Severity = 'Red' | 'Amber';
export type Verdict = 'Red' | 'Amber' | 'Clear';

export interface Item {
  sku: string;
  description: string;
  hsCode: string;
  quantity: number | null;
  unitPrice: number | null;
  unitsPerCarton: number | null;
  cartons: number | null;
  unitWeight: number | null;
  countryOfOrigin: string;
}

export interface Booking {
  id: string;
  seller: string;
  originCity: string;
  originCountry: string;
  destCity: string;
  destCountry: string;
  destType: 'Warehouse' | 'Business address' | '';
  readyDate: Date | null;
  priority: Priority | '';
  pallets: number | null;
  cartons: number | null;
  declaredValue: number | null;
  currency: 'GBP';
  grossWeight: number | null;
  appointment: 'Yes' | 'No' | '';
  items: Item[];
  valueInferred: boolean;
  cartonsInferred: boolean;
}

export interface Fix {
  label: string;
  /** What the fix buys, rendered as the delta badge on the action pill. */
  delta: string;
  apply: (b: Booking) => void;
}

export interface Issue {
  rule: string;
  severity: Severity;
  title: string;
  observed: string;
  expected: string;
  /** Names the field that is wrong, as an instruction to a seller. */
  diagnosis: string;
  /** "" when it is plain arithmetic. */
  confidence: string;
  fix: Fix | null;
  impactDays: [number, number];
  impactCost: number;
  costWhy: string;
  /** Which diagnosis branch fired. Exposed so the branches are testable. */
  branch?: string;
  /** The sku this issue is about, for per-item rules. */
  sku?: string;
  /**
   * Advice the seller must act on themselves. Classification is their legal
   * responsibility, so an HS heading is never offered as a fix.
   */
  suggestion?: string;
}

export interface CarrierRow {
  carrier: string;
  service: string;
  dest: string;
  pricePerPallet: number;
  days: number;
  onTime: number;
  maxPerPallet: number;
}

export interface Weights {
  cost: number;
  speed: number;
  reliability: number;
}

export interface ScoredCarrier {
  row: CarrierRow;
  /** pricePerPallet x pallets */
  cost: number;
  costScore: number;
  speedScore: number;
  reliabilityScore: number;
  score: number;
}

export interface ExcludedCarrier {
  row: CarrierRow;
  ceiling: number;
  cost: number;
}

export interface PalletFix {
  pallets: number;
  kgPerPallet: number;
  opens: string[];
}

export interface Recommendation {
  /** At least one service on the lane will take this weight per pallet. */
  feasible: boolean;
  /** Not enough information to rank anything yet. */
  incomplete: boolean;
  incompleteReason: string;
  weightPerPallet: number | null;
  priority: Priority;
  priorityDefaulted: boolean;
  weights: Weights;
  ranked: ScoredCarrier[];
  excluded: ExcludedCarrier[];
  winner: ScoredCarrier | null;
  runnerUp: ScoredCarrier | null;
  /** True when exactly one service survived, so there is nothing to rank. */
  nothingToRank: boolean;
  reason: string;
  runnerUpTradeoff: string;
  palletFix: PalletFix | null;
}

export interface CheckResult {
  verdict: Verdict;
  issues: Issue[];
  redCount: number;
  amberCount: number;
  exposure: number;
  worstCaseDelay: number;
  recommendation: Recommendation;
  weightPerPallet: number | null;
  netWeight: number | null;
  itemCartons: number | null;
  computedValue: number | null;
}
