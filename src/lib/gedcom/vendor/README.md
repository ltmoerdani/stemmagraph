# Vendored: gedcom7code/js-gedcom

This directory contains a vendored copy of the dependency-free GEDCOM 7
toolkit from https://github.com/gedcom7code/js-gedcom. Vendoring (instead of
an npm dependency) is a deliberate project decision: upstream is not
published as an npm package, has no dependencies, and changes rarely, so a
plain copy with recorded provenance keeps package-lock.json untouched.

## Provenance

- Upstream repository: https://github.com/gedcom7code/js-gedcom
- Upstream branch: `main`
- Upstream commit at retrieval time: `9296068bd6a461cdd93f9edc74d8457995897afe`
- Retrieved on: 2026-08-18 from raw.githubusercontent.com URLs
  of the form https://raw.githubusercontent.com/gedcom7code/js-gedcom/main/<file>
- Upstream license: dual MIT + UNLICENSE (author: Luther Tychonievich).
  Both license files are copied verbatim into this directory.
- Stemmagraph is AGPL-3.0-only; both MIT and UNLICENSE permit inclusion
  in AGPL projects.

## Files

Each vendored `.js` file is byte-identical to upstream except for a
prepended `//` provenance comment block. The pristine upstream SHA-256 of
each file (computed before the comment was prepended) is recorded in that
comment, so anyone can re-fetch upstream and verify there are no other
changes.

| File | Role | Upstream SHA-256 (pristine) |
|---|---|---|
| `gedcstruct.js` | Tag-oriented layer: GEDCStruct parser/serializer, g5/g7 dialect configs. Used by our exporter for manual structure creation and serialization. | `c0c0e2ffdf4dc6c95b089265c47d79dbf645ebcd54c7fe93f5ad91efff73f08b` |
| `g7structure.js` | Type-aware layer: G7Structure / G7Dataset, validation. Used by the verify script for type-aware checks. | `fba366b23b9fe7b8c7d1b0a46dbcf568dab0cb33cfec0a818a1f981a2517f73c` |
| `g7lookups.js` | Wraps the g7validation.json registry with tag/URI lookup logic. Used by the verify script. | `01d486bb672fb088e8f886c1df72c824ef0c7aca35a03f8ce1d21e9ac488ad6a` |
| `g7datatypes.js` | Payload datatype parsing and serialization. Dependency of g7structure.js. | `59e7b0d697a3061c578357a4147c67ad918bfe42ac73b730b44c8e8092b4de42` |
| `simpleValidator.js` | Browser demo validator page logic. Vendored for completeness; NOT imported by Stemmagraph (see note in its header). | `07abd650c6fd1b4f3a4b4fdf237139d9680d16ecca8a3eb745491eae087eaec4` |
| `LICENSE-MIT` | Upstream MIT license text, verbatim. | `f919faf71796efbf9aca2ba316b8d16b36481d8c45b330e1d9c6950206a5baf3` |
| `LICENSE-UNLICENSE` | Upstream UNLICENSE text, verbatim. | `6b0382b16279f26ff69014300541967a356a666eb0b91b422f6862f6b7dad17e` |

## Adaptation notes

- No ESM adaptation was needed. Upstream files are already native ES
  modules (plain `export` statements, no imports of external packages),
  so they work unchanged in Vite and in Node ESM (`scripts/*.mjs`).
- No code changes were made. The only diff versus upstream is the
  prepended provenance comment block in each `.js` file and this README.
- Known upstream quirk, deliberately left untouched: `G7Dataset.fromString`
  in `g7structure.js` references an undefined variable (`src` instead of
  `str`). Callers must parse with `GEDCStruct.fromString` and then
  `G7Dataset.fromGEDC`, which is exactly what `scripts/verify-gedcom70.mjs`
  does.
- `g7lookups.js` and `g7structure.js` need the official GEDCOM 7 registry
  JSON (g7validation.json from FamilySearch/GEDCOM-registries) supplied by
  the caller at runtime. Nothing in this directory bundles that registry;
  the verify script downloads and caches it separately.

## Upgrade procedure

1. Re-download the files listed above from upstream `main` (or a pinned
   commit) and re-record the commit hash and SHA-256 sums.
2. Diff against the copies here ignoring the prepended comment block.
3. Update this README and the per-file provenance comments, then re-run
   `node scripts/verify-gedcom70.mjs`.
