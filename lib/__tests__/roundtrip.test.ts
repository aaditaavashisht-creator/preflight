import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { parseWorkbook } from '../parse-xlsx';
import { validate } from '../rules';

const TODAY = new Date(2026, 9, 26);
import path from 'node:path';

// Checked in so the round trip is reproducible: this is the exact workbook the
// app's "Download corrected sheet" produced from the judge-format sample.
const FILE = path.resolve(__dirname, '../../samples/preflight-corrected-example.xlsx');

describe('the corrected sheet the app hands back', () => {
  it('re-uploads cleanly and carries the fixes', async () => {
    const parsed = await parseWorkbook(new Uint8Array(fs.readFileSync(FILE)));
    expect(parsed.bookings).toHaveLength(10);
    const byId = new Map(parsed.bookings.map((b) => [b.id, b]));

    // High-confidence corrections are present.
    expect(byId.get('BK-101')!.cartons).toBe(96);
    expect(byId.get('BK-102')!.items.find((i) => i.sku === 'TEE-10')!.unitPrice).toBe(10);
    expect(byId.get('BK-102')!.items.find((i) => i.sku === 'SOK-03')!.cartons).toBe(10);
    expect(byId.get('BK-103')!.items[0].hsCode).toBe('090121');
    expect(byId.get('BK-106')!.declaredValue).toBe(6400);
    expect(byId.get('BK-109')!.cartons).toBe(150);

    // Judgement calls are untouched.
    expect(byId.get('BK-103')!.appointment).toBe('No');
    expect(byId.get('BK-103')!.items[0].countryOfOrigin).toBe('');
    expect(byId.get('BK-108')!.items.find((i) => i.sku === 'CND-21')!.hsCode).toBe('');

    // What is left is only what a human must decide:
    //   R-01 a blank commodity code, which is the seller's legal call
    //   R-03 the pack size branch, which is Medium and says to count a carton
    //   R-06 dangerous goods, which is never auto-fixed
    //   R-08 a slot nobody has actually booked
    //   R-09 an origin only the supplier knows
    //   R-10 a date only the seller can commit to
    const left = new Set<string>();
    for (const b of parsed.bookings) for (const i of validate(b, TODAY)) left.add(i.rule);
    expect([...left].sort()).toEqual(['R-01', 'R-03', 'R-06', 'R-08', 'R-09', 'R-10']);
    // R-05 is arithmetic, so the corrected sheet did re-plan the pallets.
    expect(byId.get('BK-103')!.pallets).toBe(3);
    expect(byId.get('BK-109')!.pallets).toBe(5);
  });
});
