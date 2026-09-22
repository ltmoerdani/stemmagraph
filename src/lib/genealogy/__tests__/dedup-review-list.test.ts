import { describe, expect, it } from "vitest";
import {
  applyReviewerDecision,
  buildDedupReviewList,
  reviewQueueSummary,
  type DedupCandidate,
} from "../dedup-review-list";

function cand(idA: string, idB: string, score: number, reasons: string[] = ["nama mirip"]): DedupCandidate {
  return { idA, idB, score, reasons };
}

describe("buildDedupReviewList", () => {
  it("memisahkan dua zona sesuai ambang", () => {
    const list = buildDedupReviewList([
      cand("a", "b", 95),
      cand("c", "d", 70),
      cand("e", "f", 30),
    ]);
    expect(list.strong).toHaveLength(1);
    expect(list.review).toHaveLength(1);
    expect(list.strong[0].idA).toBe("a");
    expect(list.review[0].idA).toBe("c");
  });

  it("boundary tepat 80 masuk zona kuat", () => {
    const list = buildDedupReviewList([cand("a", "b", 80)]);
    expect(list.strong).toHaveLength(1);
    expect(list.review).toHaveLength(0);
  });

  it("boundary tepat 79 masuk zona review", () => {
    const list = buildDedupReviewList([cand("a", "b", 79)]);
    expect(list.strong).toHaveLength(0);
    expect(list.review).toHaveLength(1);
  });

  it("boundary tepat 60 masuk zona review", () => {
    const list = buildDedupReviewList([cand("a", "b", 60)]);
    expect(list.strong).toHaveLength(0);
    expect(list.review).toHaveLength(1);
    expect(list.review[0].score).toBe(60);
  });

  it("di bawah 60 diabaikan", () => {
    const list = buildDedupReviewList([cand("a", "b", 59), cand("c", "d", 0)]);
    expect(list.strong).toHaveLength(0);
    expect(list.review).toHaveLength(0);
  });

  it("urutan stabil deterministik dalam tiap zona", () => {
    const list = buildDedupReviewList([
      cand("p2", "q2", 85),
      cand("p1", "q1", 90),
      cand("r2", "s2", 65),
      cand("r1", "s1", 75),
    ]);
    expect(list.strong.map((c) => c.idA)).toEqual(["p2", "p1"]);
    expect(list.review.map((c) => c.idA)).toEqual(["r2", "r1"]);
  });

  it("list kosong menghasilkan zona kosong", () => {
    const list = buildDedupReviewList([]);
    expect(list.strong).toEqual([]);
    expect(list.review).toEqual([]);
  });

  it("tidak mengubah array input", () => {
    const input = [cand("a", "b", 80), cand("c", "d", 60)];
    const snapshot = [...input];
    buildDedupReviewList(input);
    expect(input).toEqual(snapshot);
  });
});

describe("applyReviewerDecision", () => {
  it("menerima keputusan ACCEPT (merge)", () => {
    expect(applyReviewerDecision("pair-1", "ACCEPT")).toEqual({ pairId: "pair-1", decision: "ACCEPT" });
  });

  it("menerima keputusan REJECT (bukan duplikat)", () => {
    expect(applyReviewerDecision("pair-2", "REJECT")).toEqual({ pairId: "pair-2", decision: "REJECT" });
  });

  it("menerima keputusan SKIP (tunda)", () => {
    expect(applyReviewerDecision("pair-3", "SKIP")).toEqual({ pairId: "pair-3", decision: "SKIP" });
  });
});

describe("reviewQueueSummary", () => {
  it("summary konsisten dengan isi list", () => {
    const list = buildDedupReviewList([
      cand("a", "b", 81),
      cand("c", "d", 90),
      cand("e", "f", 60),
      cand("g", "h", 72),
    ]);
    const summary = reviewQueueSummary(list);
    expect(summary).toEqual({ strongCount: 2, reviewCount: 2, total: 4 });
  });

  it("summary list kosong nol semua", () => {
    const summary = reviewQueueSummary(buildDedupReviewList([]));
    expect(summary).toEqual({ strongCount: 0, reviewCount: 0, total: 0 });
  });
});
