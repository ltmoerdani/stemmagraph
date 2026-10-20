/**
 * Multiple birth rate per century (v324 fase i): modul PURE untuk
 * statistik kelahiran kembar, pilar 2 VISION-stemmagraph. Jangkar:
 * wt_statistic.php getMultipleBirthRateByCentury baris 1009, satu
 * series per multiplicity (twins/triplets/quadruplets/quintuplets+),
 * share per abad atas dasar dated births, deteksi sibling satu FAM
 * dengan BIRT berjarak <= 1 hari.
 *
 * DEFINISI: dua birth dalam satu family dianggap multiple birth bila
 * keduanya tanggal lengkap (year+month+day non-null) DAN selisih hari
 * absolut <= 1 hari. Selisih hari dihitung via Date.UTC tanpa zona
 * waktu sehingga lintas tengah malam (31 Des ke 1 Jan) tetap sah.
 *
 * Kelompok memakai konektivitas transitif dalam satu family: A-B
 * kembar dan B-C kembar menjadikan A-B-C satu kelompok triplet.
 * Abad kelompok diambil dari anggota TERTUA (tanggal paling awal),
 * deterministik dan bebas urutan input; label abad
 * "<start>-<start+99>".
 *
 * Tanggal parsial (ada komponen null) SAH sebagai input dan dihitung
 * undated: tidak ikut deteksi kembar, tidak masalahkan abad.
 *
 * Parser strict (pola v308-v323): parseFamilyBirthGroups LEMPAR
 * Error dengan nama field dan indeks saat payload salah, DILARANG
 * silent-filter.
 *
 * Deterministik: tanpa jam sistem, tanpa randomness, agregasi per
 * kunci sehingga urutan array input tidak mengubah output.
 */

export interface FamilyBirth {
  birthYear: number | null
  birthMonth: number | null
  birthDay: number | null
}

export interface FamilyBirthGroup {
  familyId: string
  births: FamilyBirth[]
}

export interface MultipleBirthRateCentury {
  start: number
  label: string
}

export interface MultipleBirthRateCell {
  centuryStart: number
  sharePct: number
  count: number
}

export interface MultipleBirthRateSeriesEntry {
  multiplicity: number
  cells: MultipleBirthRateCell[]
}

export interface MultipleBirthRatePayload {
  centuries: MultipleBirthRateCentury[]
  series: MultipleBirthRateSeriesEntry[]
  totalBirths: number
  datedBirths: number
  multipleBirths: number
}

/** Tanggal lengkap => jumlah hari proleptic Gregorian via Date.UTC. */
function exactUtcDays(birth: FamilyBirth): number | null {
  const { birthYear, birthMonth, birthDay } = birth
  if (birthYear === null || birthMonth === null || birthDay === null) return null
  return Date.UTC(birthYear, birthMonth - 1, birthDay) / 86_400_000
}

function isDated(birth: FamilyBirth): boolean {
  return birth.birthYear !== null && birth.birthMonth !== null && birth.birthDay !== null
}

function centuryStartFor(year: number): number {
  return Math.floor(year / 100) * 100
}

function centuryLabel(start: number): string {
  return `${start}-${start + 99}`
}

/**
 * Kelompok indeks birth dalam satu family via union-find: pasangan
 * bertetangga bila keduanya dated dan selisih hari absolut <= 1.
 * Return daftar kelompok berisi indeks, hanya ukuran >= 2.
 */
function groupMultipleBirths(births: FamilyBirth[]): number[][] {
  const n = births.length
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i += 1) parent[i] = i

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }

  function union(a: number, b: number): void {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  const days = births.map(exactUtcDays)
  for (let i = 0; i < n; i += 1) {
    if (days[i] === null) continue
    for (let j = i + 1; j < n; j += 1) {
      if (days[j] === null) continue
      if (Math.abs(days[i] - days[j]) <= 1) union(i, j)
    }
  }

  const byRoot = new Map<number, number[]>()
  for (let i = 0; i < n; i += 1) {
    const root = find(i)
    const bucket = byRoot.get(root)
    if (bucket === undefined) byRoot.set(root, [i])
    else bucket.push(i)
  }
  return [...byRoot.values()].filter((group) => group.length >= 2)
}

/**
 * Hitung multiple birth rate per abad. Input kosong atau nihil
 * kelompok tetap mengembalikan payload utuh tanpa throw.
 */
export function computeMultipleBirthRate(
  groups: FamilyBirthGroup[],
): MultipleBirthRatePayload {
  let totalBirths = 0
  let datedBirths = 0
  let multipleBirths = 0

  const datedPerCentury = new Map<number, number>()
  const groupCountPerCentury = new Map<number, Map<number, number>>()

  for (const group of groups) {
    for (const birth of group.births) {
      totalBirths += 1
      if (!isDated(birth)) continue
      datedBirths += 1
      const centuryStart = centuryStartFor(birth.birthYear)
      datedPerCentury.set(centuryStart, (datedPerCentury.get(centuryStart) ?? 0) + 1)
    }

    const dayByIndex = new Map<number, number>()
    group.births.forEach((birth, index) => {
      const days = exactUtcDays(birth)
      if (days !== null) dayByIndex.set(index, days)
    })

    for (const memberIndexes of groupMultipleBirths(group.births)) {
      // Semua anggota kelompok pasti dated (union hanya menyatukan
      // birth bertanggal lengkap).
      let earliestDays = Number.POSITIVE_INFINITY
      for (const index of memberIndexes) {
        const days = dayByIndex.get(index) as number
        if (days < earliestDays) earliestDays = days
      }
      // Abad kelompok dari anggota PERTAMA lahir (tanggal paling
      // awal); deterministik, bebas urutan input.
      const firstBorn = memberIndexes.find(
        (index) => dayByIndex.get(index) === earliestDays,
      ) as number
      const centuryStart = centuryStartFor(group.births[firstBorn].birthYear as number)
      // Hitungan berbasis BIRTH (bukan delivery) agar sharePct selaras
      // jangkar "share of dated births" dan multipleBirths = jumlah
      // seluruh count di series.
      const multiplicity = memberIndexes.length
      multipleBirths += multiplicity
      let perCentury = groupCountPerCentury.get(multiplicity)
      if (perCentury === undefined) {
        perCentury = new Map<number, number>()
        groupCountPerCentury.set(multiplicity, perCentury)
      }
      perCentury.set(centuryStart, (perCentury.get(centuryStart) ?? 0) + multiplicity)
    }
  }

  const centuryStarts = [...datedPerCentury.keys()].sort((a, b) => a - b)
  const centuries = centuryStarts.map((start) => ({
    start,
    label: centuryLabel(start),
  }))

  const multiplicities = [...groupCountPerCentury.keys()].sort((a, b) => a - b)
  const series = multiplicities.map((multiplicity) => {
    const perCentury = groupCountPerCentury.get(multiplicity) as Map<number, number>
    const cells = [...perCentury.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => a[0] - b[0])
      .map(([centuryStart, count]) => {
        const base = datedPerCentury.get(centuryStart) ?? 0
        const sharePct = base === 0 ? 0 : Math.round((count / base) * 1000) / 10
        return { centuryStart, sharePct, count }
      })
    return { multiplicity, cells }
  })

  return { centuries, series, totalBirths, datedBirths, multipleBirths }
}

/** Validasi satu birth; lempar Error dengan indeks family dan birth. */
function assertBirth(raw: unknown, familyIndex: number, birthIndex: number): FamilyBirth {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(
      `multiple birth rate family[${familyIndex}].births[${birthIndex}]: bukan objek`,
    )
  }
  const record = raw as Record<string, unknown>
  for (const field of ['birthYear', 'birthMonth', 'birthDay'] as const) {
    const value = record[field]
    if (typeof value !== 'number' && value !== null) {
      throw new Error(
        `multiple birth rate family[${familyIndex}].births[${birthIndex}].${field}: bukan number atau null`,
      )
    }
  }
  return {
    birthYear: record.birthYear as number | null,
    birthMonth: record.birthMonth as number | null,
    birthDay: record.birthDay as number | null,
  }
}

/** Validasi satu family; lempar Error dengan indeks dan nama field. */
function assertFamilyBirthGroup(raw: unknown, index: number): FamilyBirthGroup {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`multiple birth rate family[${index}]: bukan objek`)
  }
  const record = raw as Record<string, unknown>
  if (typeof record.familyId !== 'string') {
    throw new Error(`multiple birth rate family[${index}].familyId: hilang atau bukan string`)
  }
  if (!Array.isArray(record.births)) {
    throw new Error(`multiple birth rate family[${index}].births: bukan array`)
  }
  return {
    familyId: record.familyId,
    births: record.births.map((birth, birthIndex) =>
      assertBirth(birth, index, birthIndex),
    ),
  }
}

/**
 * Parser strict payload multiple birth rate. Payload bukan array,
 * elemen bukan objek, familyId bukan string, births bukan array,
 * atau field tanggal bukan number/null => LEMPAR Error.
 */
export function parseFamilyBirthGroups(payload: unknown): FamilyBirthGroup[] {
  if (!Array.isArray(payload)) {
    throw new Error('multiple birth rate payload: bukan array')
  }
  return payload.map((group, index) => assertFamilyBirthGroup(group, index))
}
