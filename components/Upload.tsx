'use client';

import { useRef, useState } from 'react';
import { parseWorkbook, type ParseResult, type ParseWarning } from '@/lib/parse-xlsx';
import { buildSampleWorkbook } from '@/lib/sample-xlsx';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Upload({
  today, onParsed, onDemo, warnings,
}: {
  today: Date;
  onParsed: (r: ParseResult) => void;
  onDemo: () => void;
  warnings: ParseWarning[];
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const result = await parseWorkbook(buf);
      if (result.bookings.length === 0) {
        setError(
          'No bookings were found in that workbook. It needs a sheet of booking rows and a ' +
          'sheet of item rows, joined on a booking id column.',
        );
      }
      onParsed(result);
    } catch {
      setError('That file could not be read as a spreadsheet. Try .xlsx, .xlsm or .csv.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 14, borderBottom: '1px solid var(--hairline)' }}>
      <div
        className="dropzone"
        data-over={over ? 'true' : 'false'}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
      >
        <p className="t-card-title">Drop your workbook here</p>
        <p className="t-small muted" style={{ marginTop: 4 }}>
          Parsed in this browser. Nothing is uploaded anywhere.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 12 }}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Reading…' : 'Choose a file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={onDemo}>Load the demo set</button>
        <button
          type="button"
          className="btn"
          onClick={async () => download(await buildSampleWorkbook(today), 'preflight-sample.xlsx')}
        >
          Download sample file
        </button>
      </div>

      {error && (
        <p className="t-small sev-red sev-text" style={{ marginTop: 10 }}>{error}</p>
      )}

      {warnings.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="t-small muted" style={{ cursor: 'pointer' }}>
            {warnings.length} note{warnings.length === 1 ? '' : 's'} from the last file
          </summary>
          <ul style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {warnings.map((w, n) => (
              <li key={n} className="t-small muted" style={{ listStyle: 'none' }}>{w.message}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export { download };
