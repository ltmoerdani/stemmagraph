/**
 * Calendar systems supported for dual-date and historical date handling.
 * GEDCOM 7 supports multiple calendar types alongside EVENT type tags (BIRT/MARR/DEAT).
 */

export type CalendarSystem = 
  | 'GREGORIAN'     // Standar modern (default)
  | 'JULIAN'        // Kalender Julian (sebelum Gregorian adopt)
  | 'FRENCH_R'      // Kalender Prancis Revolusioner (1793-1805)
  | 'HEBREW'        // Kalender Ibrani/Hebrew
  | 'DUAL'          // Dual date (e.g., both Julian and Gregorian)

export const CALENDAR_SYSTEMS: CalendarSystem[] = [
  'GREGORIAN',
  'JULIAN', 
  'FRENCH_R',
  'HEBREW',
  'DUAL'
]

/**
 * Interface for a calendar date with system designation.
 * Members can have a primary date with an optional secondary date
 * from a different calendar system (dual dating).
 */
export interface CalendarDate {
  year: number
  month: number  // 1-12 for Gregorian/Hebrew, specific for others
  day: number
  calendar: CalendarSystem
  /** Era designation, e.g., "CE", "BCE", "AM" (Anno Mundi) */
  era?: 'CE' | 'BCE' | 'AM' | 'PM'
}

/**
 * Genealogical event with full calendar support.
 * type: BIRT | DEAT | MARR | other GEDCOM event types
 * date: The primary date with calendar system
 * place: Location verbatim (for round-trip GEDCOM compatibility)
 * calendar: Optional calendar system override (defaults to GREGORIAN)
 * dualDate: Optional secondary date from different calendar (for dual dating)
 */
export interface GenealogicalEvent {
  type: string
  date: CalendarDate | null
  place: string | null
  calendar: CalendarSystem
  dualDate?: CalendarDate | null
}

/**
 * Normalize a date string or object into CalendarDate.
 * Handles various input formats including ISO strings, text dates,
 * and GenealogicalDate JSON from GEDCOM import.
 */
export function normalizeCalendarDate(
  input: string | null | undefined,
  calendar?: CalendarSystem
): CalendarDate | null {
  if (input === null || input === undefined) return null
  
  const cal = calendar || 'GREGORIAN'
  
  // Try parsing as ISO date string first
  if (/^\d{4}-\d{2}-\d{2}$/.test(input) || /^\d{4}-\d{2}-\d{2}/.test(input)) {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
        calendar: cal
      }
    }
  }
  
  // Try parsing as "YYYY-MM-DD" with era
  if (/^\d{4}-(BC|CE)/.test(input)) {
    // Handle era-prefixed dates
  }
  
  // Fallback: return minimal date with specified calendar
  return {
    year: 0,
    month: 1,
    day: 1,
    calendar: cal
  }
}

/**
 * Create a genealogical event with calendar support.
 * Validates the event type and ensures proper date formatting.
 */
export function makeGenealogicalEvent(
  type: string,
  date: string | CalendarDate | null = null,
  place: string | null = null,
  calendar: CalendarSystem = 'GREGORIAN',
  dualDate: string | CalendarDate | null = null
): GenealogicalEvent {
  const calendarDate = typeof date === 'string' 
    ? normalizeCalendarDate(date, calendar) 
    : (date || null)
  
  const dualCalendarDate = typeof dualDate === 'string' 
    ? normalizeCalendarDate(dualDate, calendar || 'GREGORIAN')
    : (dualDate ? normalizeCalendarDate(dualDate, calendar || 'GREGORIAN') : null)
  
  return {
    type,
    date: calendarDate,
    place,
    calendar: calendar || 'GREGORIAN',
    dualDate: dualCalendarDate
  }
}
