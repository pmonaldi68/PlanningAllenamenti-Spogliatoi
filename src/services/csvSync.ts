import { DayOfWeek, TrainingSession } from '../types';

/**
 * Converts a standard Google Sheets share link or edit link into a direct CSV export link.
 */
export function normalizeGoogleSheetCsvUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();

  // If it's already a pub?output=csv link or export?format=csv
  if (trimmed.includes('output=csv') || trimmed.includes('format=csv')) {
    return trimmed;
  }

  // If it's a published web link: /spreadsheets/d/e/2PACX-.../pubhtml or /pub
  if (trimmed.includes('/pubhtml') || trimmed.includes('/pub')) {
    return trimmed.replace(/\/pubhtml.*$/, '/pub?output=csv').replace(/\/pub(\?.*)?$/, '/pub?output=csv');
  }

  // If it's standard /spreadsheets/d/{SPREADSHEET_ID}/edit...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    const id = match[1];
    // Check if there is a specific sheet gid
    const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
    const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gidParam}`;
  }

  return trimmed;
}

/**
 * Robust CSV parser that handles quotes, line breaks inside quotes,
 * and detects delimiters (, or ; or \t).
 */
export function parseCsvText(csvText: string): string[][] {
  if (!csvText || !csvText.trim()) return [];

  // Detect delimiter using the first non-empty line
  const firstLine = csvText.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n in CRLF
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses time slot strings like "17:30 - 19:00", "18.00-19.30 (Campo A)"
 */
export function parseTimeAndField(cellText: string): {
  startTime: string;
  endTime: string;
  field?: string;
  notes?: string;
} | null {
  if (!cellText || typeof cellText !== 'string') return null;
  const text = cellText.trim();
  if (
    !text ||
    text === '-' ||
    text.toLowerCase() === 'riposo' ||
    text.toLowerCase() === 'libero' ||
    text.toLowerCase() === 'nessuno'
  ) {
    return null;
  }

  const timeRegex = /(\d{1,2}[:.]\d{2})\s*(?:-|–|a|alle|\/)\s*(\d{1,2}[:.]\d{2})/i;
  const match = text.match(timeRegex);

  let startTime = '17:30';
  let endTime = '19:00';
  let field: string | undefined = undefined;
  let notes: string | undefined = undefined;

  if (match) {
    startTime = match[1].replace('.', ':');
    endTime = match[2].replace('.', ':');

    if (startTime.length === 4) startTime = '0' + startTime;
    if (endTime.length === 4) endTime = '0' + endTime;

    const remaining = text.replace(match[0], '').replace(/[()]/g, ' ').trim();
    if (remaining) {
      if (/campo|sintetico|erba|gabbia|palestra/i.test(remaining)) {
        field = remaining;
      } else {
        notes = remaining;
      }
    }
  } else {
    notes = text;
  }

  return { startTime, endTime, field, notes };
}

/**
 * Parses raw CSV rows with headers:
 * Squadra | Lunedì | Martedì | Mercoledì | Giovedì | Venerdì | (Sabato | Domenica)
 */
export function parseCsvRowsToSessions(rows: string[][]): {
  sessions: TrainingSession[];
  teams: string[];
  headers: string[];
} {
  if (!rows || rows.length < 2) {
    return { sessions: [], teams: [], headers: [] };
  }

  const headers = rows[0].map((h) => (h || '').trim());
  const dayColMap: { [colIdx: number]: DayOfWeek } = {};
  let teamColIdx = 0;

  headers.forEach((header, idx) => {
    const h = header.toLowerCase();
    if (h.includes('squadra') || h.includes('categoria') || h.includes('leva') || h.includes('team')) {
      teamColIdx = idx;
    } else if (h.includes('lun')) {
      dayColMap[idx] = 'Lunedì';
    } else if (h.includes('mar')) {
      dayColMap[idx] = 'Martedì';
    } else if (h.includes('mer')) {
      dayColMap[idx] = 'Mercoledì';
    } else if (h.includes('gio')) {
      dayColMap[idx] = 'Giovedì';
    } else if (h.includes('ven')) {
      dayColMap[idx] = 'Venerdì';
    } else if (h.includes('sab')) {
      dayColMap[idx] = 'Sabato';
    } else if (h.includes('dom')) {
      dayColMap[idx] = 'Domenica';
    }
  });

  const sessions: TrainingSession[] = [];
  const teamsSet = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const team = (row[teamColIdx] || '').trim();
    if (!team) continue;
    teamsSet.add(team);

    Object.entries(dayColMap).forEach(([colIdxStr, dayName]) => {
      const colIdx = parseInt(colIdxStr, 10);
      const cellValue = row[colIdx];
      if (!cellValue) return;

      const parsed = parseTimeAndField(cellValue);
      if (parsed) {
        // Default training pitch logic as requested:
        // Default: "Via Sardegna"
        // Wednesday Under 19 Provinciale: "Monte Due Torri"
        let effectiveField = parsed.field;
        if (!effectiveField) {
          const isU19 = /under\s*19|u19|juniores/i.test(team);
          if (dayName === 'Mercoledì' && isU19) {
            effectiveField = 'Monte Due Torri';
          } else {
            effectiveField = 'Via Sardegna';
          }
        }

        sessions.push({
          id: `session-${team.replace(/\s+/g, '-').toLowerCase()}-${dayName.toLowerCase()}-${r}`,
          team,
          day: dayName,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          field: effectiveField,
          notes: parsed.notes,
        });
      }
    });
  }

  return {
    sessions,
    teams: Array.from(teamsSet),
    headers,
  };
}

/**
 * Fetches the CSV content from a URL with CORS support / proxy fallback if needed.
 */
export async function fetchCsvFromUrl(url: string): Promise<string> {
  const normalized = normalizeGoogleSheetCsvUrl(url);

  try {
    const res = await fetch(normalized, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`Errore HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.text();
  } catch (err: any) {
    // If standard fetch failed (e.g. CORS on some setups), try an open public CORS proxy fallback
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(normalized)}`;
      const proxyRes = await fetch(proxyUrl, { cache: 'no-cache' });
      if (proxyRes.ok) {
        return await proxyRes.text();
      }
    } catch {
      // ignore secondary proxy error
    }
    throw new Error(
      `Impossibile scaricare il CSV da "${url}". Verifica che il foglio sia "Pubblicato sul Web" come CSV o condivisibile pubblicamente.`
    );
  }
}
