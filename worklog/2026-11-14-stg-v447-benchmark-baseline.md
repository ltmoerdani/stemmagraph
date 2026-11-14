# Worklog QA: STG v447 benchmark baseline

- Tanggal: 14 Nov 2026, sekitar 06:07 sampai 06:25 UTC+7
- Project: Stemmagraph, branch improve/stg-v447-benchmark-baseline (base develop 6bd33f8)
- Putaran QA: 1, tugas riset-only (harness + baseline, bukan audit)
- Verdict: SELESAI, semua gate hijau
- Gate: tsc root exit 0; tsc perf self-check exit 0; eslint 4 file karya nihil error; vitest tests/perf 4/4 pass; em dash 0 di semua file dan commit
- Hasil baseline steady state (median rep2 rep3, 100 frame): 2000 node avg 0.031 to 0.033 ms, p95 0.043 to 0.046 ms, p99 0.052 to 0.067 ms, long task 0. 5000 node avg 0.093 to 0.106 ms, p95 0.141 to 0.147 ms, p99 0.159 to 0.166 ms, long task 0. Heap n/a (node v20 tanpa API heap; jalur null terguard).
- Catatan: rep1 selalu lebih lambat (bias JIT proses baru), outlier p99 GC sporadis di server shared. Metodologi: warmup 3 frame, 3 repetisi x 100 frame. Detail di docs/perf/v447-benchmark-baseline.md.
- Commit: 040dc29 (harness + config), 639a2a4 (benchmark + guard), b2dc009 (docs). Semua ter-push ke origin branch tsb.
- File: tests/perf/render-harness.ts, tests/perf/benchmark-baseline.test.ts, tests/perf/vitest.perf.config.ts, tests/perf/tsconfig.json, tests/perf/perf-fixtures.d.ts, docs/perf/v447-benchmark-baseline.md
- Tidak menyentuh src/, server/, package.json, lockfile. develop di-checkout ulang setelah selesai.
