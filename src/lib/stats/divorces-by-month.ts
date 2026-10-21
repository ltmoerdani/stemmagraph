export interface DivorcesByMonthResult {
  months: number[]; // [12] integer non-negatif, indeks 0=januari sampai 11=desember
  total: number;
  peakMonth: number | null; // 1-12, nullable saat total 0
  peakCount: number | null;
}

export function computeDivorcesByMonth(entries: unknown): DivorcesByMonthResult {
  if (!Array.isArray(entries)) {
    throw new Error('divorces-by-month: input must be an array');
  }

  const validEntries: { personId: string; divorceDate: string }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry === null || entry === undefined || typeof entry !== 'object') {
      throw new Error('divorces-by-month: entry at index ' + i + ' must be an object');
    }
    const typedEntry = entry as { personId?: unknown; divorceDate?: unknown };
    if (typeof typedEntry.personId !== 'string') {
      throw new Error('divorces-by-month: entry at index ' + i + ' personId must be a string');
    }
    if (typeof typedEntry.divorceDate !== 'string') {
      throw new Error('divorces-by-month: entry at index ' + i + ' divorceDate must be a string');
    }

    const dateStr = typedEntry.divorceDate;
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = dateStr.match(dateRegex);
    if (!match) {
      throw new Error('divorces-by-month: entry at index ' + i + ' divorceDate must be in YYYY-MM-DD format');
    }

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    if (month < 1 || month > 12) {
      throw new Error('divorces-by-month: entry at index ' + i + ' month must be between 01 and 12');
    }

    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInMonth = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (day < 1 || day > daysInMonth[month]) {
      throw new Error('divorces-by-month: entry at index ' + i + ' day is invalid for the given month and year');
    }

    validEntries.push({ personId: typedEntry.personId, divorceDate: dateStr });
  }

  const months: number[] = new Array(12).fill(0);
  let total = 0;
  let peakMonth: number | null = null;
  let peakCount: number | null = null;

  for (const entry of validEntries) {
    const monthIndex = parseInt(entry.divorceDate.substring(5, 7), 10) - 1;
    months[monthIndex]++;
    total++;
  }

  if (total > 0) {
    let maxCount = -1;
    for (let i = 0; i < 12; i++) {
      if (months[i] > maxCount) {
        maxCount = months[i];
        peakMonth = i + 1;
        peakCount = maxCount;
      } else if (months[i] === maxCount && peakMonth !== null && i + 1 < peakMonth) {
        peakMonth = i + 1;
        peakCount = maxCount;
      }
    }
  }

  return { months, total, peakMonth, peakCount };
}