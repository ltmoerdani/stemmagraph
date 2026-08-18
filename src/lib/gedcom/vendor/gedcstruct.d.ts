// Ambient type declarations for the vendored upstream gedcstruct.js.
//
// IMPORTANT: this .d.ts is Stemmagraph-authored documentation glue, NOT
// part of the vendored upstream code (upstream ships untyped JavaScript).
// It only describes the API surface our exporter and verify script rely
// on. If upstream changes, update this file accordingly.
// Upstream source: https://github.com/gedcom7code/js-gedcom (see README.md
// in this directory for provenance and pristine SHA-256 checksums).

export declare class GEDCStruct {
  /** The structure tag, e.g. "INDI", "NAME", "FAM". */
  tag: string
  /**
   * The payload: a string payload, a resolved GEDCStruct pointer payload,
   * null for an unresolvable pointer, or undefined for no payload.
   */
  payload: string | GEDCStruct | null | undefined
  /** Substructures of this structure. */
  sub: GEDCStruct[]
  /**
   * @param tag - the structure tag
   * @param sup - the superstructure; the new structure is pushed onto
   *   sup.sub automatically unless sup is null (top-level record)
   * @param ptr - a pointer payload: either a GEDCStruct (already
   *   resolved) or a bare xref string that fixPtrs() will resolve later
   * @param str - a string payload; ignored when ptr is supplied
   * @param id - the preferred xref (without surrounding @) used when
   *   serializing pointers that target this structure
   */
  constructor(
    tag: string,
    sup: GEDCStruct | null,
    ptr?: GEDCStruct | string,
    str?: string,
    id?: string,
  )
  /** The superstructure containing this structure, or null for records. */
  readonly superstruct: GEDCStruct | null
  /** Structures whose payload points to this structure. */
  readonly references: readonly GEDCStruct[]
  /** Recommended xref (without surrounding @) for pointers to this structure. */
  readonly xref_id: string | undefined
  /**
   * Resolves bare string pointer payloads via the given id map and makes
   * sure every pointed-to structure carries a usable xref id.
   */
  fixPtrs(
    ids: Record<string, GEDCStruct | null>,
    logger?: (msg: string) => void,
  ): void
  /**
   * Serializes this structure (and its substructures) to GEDC lines.
   * @param newline - line separator, defaults to "\n"
   * @param maxlen - if positive, wraps long payloads using CONC; pass a
   *   negative value (GEDCOM 7 style, e.g. -1) to disable wrapping
   * @param escapes - if true, payloads starting "@#" are not escaped;
   *   GEDCOM 7 uses false
   */
  toString(newline?: string, maxlen?: number, escapes?: boolean): string
  /** JSON-friendly representation (tag, id, href/text, sub). */
  toJSON(): Record<string, unknown>
  /** First structure matching the given GEDC dot-notation path. */
  querySelector(path: string): GEDCStruct | undefined
  /** All structures matching the given GEDC dot-notation path. */
  querySelectorAll(path: string): Generator<GEDCStruct, void, unknown>
  /**
   * Parses a GEDC string into an array of top-level structures. The
   * returned array carries querySelector/querySelectorAll/toString
   * helpers of its own.
   */
  static fromString(
    input: string,
    config?: Record<string, unknown>,
    logger?: (msg: string) => void,
  ): GEDCStruct[] & {
    querySelector(path: string): GEDCStruct | undefined
    querySelectorAll(path: string): Generator<GEDCStruct, void, unknown>
    toString(newline?: string): string
  }
  /** Rebuilds structures from toJSON() output. */
  static fromJSON(o: unknown, ids?: unknown, sup?: unknown): unknown
}

/** GEDCOM 5.x-compatible parse/serialize configuration (unused here, vendored for parity). */
export declare const g5ConfGEDC: Record<string, unknown>
/** GEDCOM 7.x-compatible parse/serialize configuration. */
export declare const g7ConfGEDC: Record<string, unknown>
/** Serialization helper for arrays of GEDCStruct. */
export declare function GEDCToString(this: unknown[], newline?: string): string
