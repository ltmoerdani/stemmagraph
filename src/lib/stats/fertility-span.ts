export interface FamilyChildrenInput {
  familyId: string;
  childBirthDates: string[];
}

export interface FertilitySpanResult {
  familyId: string;
  childCount: number;
  spanDays: number;
  spanMonths: number;
  earliestBirthDate: string | null;
  latestBirthDate: string | null;
}

interface ParsedDate {
  iso: string;
  year: number;
  month: number;
  day: number;
  serial: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) return 29;
  return lengths[month - 1];
}

export function parseStrictIsoDate(raw: string): ParsedDate {
  if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
    throw new Error(`Invalid birth date format: ${JSON.stringify(raw)}, expected strict YYYY-MM-DD`);
  }
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(5, 7));
  const day = Number(raw.slice(8, 10));
  const monthValid = month >= 1 && month <= 12;
  const dayValid = day >= 1 && day <= daysInMonth(year, month);
  if (!monthValid || !dayValid) {
    throw new Error(`Invalid calendar date: ${raw}`);
  }
  const serial = Date.UTC(year, month - 1, day);
  return { iso: raw, year, month, day, serial };
}

function spanWholeMonths(min: ParsedDate, max: ParsedDate): number {
  const months = (max.year - min.year) * 12 + (max.month - min.month);
  const anniversaryReached = max.day >= min.day;
  return anniversaryReached ? months : months - 1;
}

export function computeFertilitySpan(families: FamilyChildrenInput[]): FertilitySpanResult[] {
  const sortedFamilies = [...families].sort((a, b) => a.familyId.localeCompare(b.familyId));

  return sortedFamilies.map(fam => {
    const dates = fam.childBirthDates.map(parseStrictIsoDate).sort((a, b) => a.serial - b.serial);

    const childCount = dates.length;
    if (childCount < 2) {
      const only = childCount === 1 ? dates[0].iso : null;
      return {
        familyId: fam.familyId,
        childCount,
        spanDays: 0,
        spanMonths: 0,
        earliestBirthDate: only,
        latestBirthDate: only,
      };
    }

    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    const spanDays = Math.round((latest.serial - earliest.serial) / 86400000);
    const spanMonths = Math.max(0, spanWholeMonths(earliest, latest));

    return {
      familyId: fam.familyId,
      childCount,
      spanDays,
      spanMonths,
      earliestBirthDate: earliest.iso,
      latestBirthDate: latest.iso,
    };
  });
}
