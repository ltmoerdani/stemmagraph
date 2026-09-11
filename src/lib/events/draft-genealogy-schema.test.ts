import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const REPO_ROOT = new URL("../../../", import.meta.url);
const DRAFT_PATH = new URL("prisma/schema-genealogy-draft.prisma", REPO_ROOT);

function draftSchemaText(): string {
  return readFileSync(DRAFT_PATH, "utf8");
}

describe("draft skema genealogi-grade (ADR 0011, fase 1)", () => {
  const text = draftSchemaText();

  it("berkas draft ada dan menandai dirinya DRAFT", () => {
    expect(text).toContain("DRAFT S1");
    expect(text).toContain("TIDAK dimuat Prisma generator");
  });

  it("punya model Place, Source, Citation, LifeEvent", () => {
    for (const model of ["Place", "Source", "Citation", "LifeEvent"]) {
      expect(text).toMatch(new RegExp(`model ${model} \\{`));
    }
  });

  it("enum Gender punya UNKNOWN dan tanpa default male", () => {
    expect(text).toMatch(/enum Gender \{[\s\S]*UNKNOWN/);
    expect(text).toMatch(/enum Gender \{[\s\S]*OTHER/);
    expect(text).not.toMatch(/Gender @default\(MALE\)/);
  });

  it("enum DateKind mencakup presisi tidak pasti", () => {
    for (const kind of ["EXACT", "ABOUT", "BEFORE", "AFTER", "RANGE"]) {
      expect(text).toMatch(new RegExp(`enum DateKind \\{[\\s\\S]*${kind}`));
    }
  });

  it("tanggal bertipe: komposit kind + start/end + teks asli sumber", () => {
    expect(text).toContain("dateKind          DateKind");
    expect(text).toContain("yearStart         Int?");
    expect(text).toContain("yearEnd           Int?");
    expect(text).toContain("originalDateString String");
  });

  it("LifeEvent mengaitkan pasangan dan sumber", () => {
    expect(text).toContain("partnerMemberId String?");
    expect(text).toContain("eventType       LifeEventType");
    expect(text).toContain("citationId      String?");
    expect(text).toContain("placeId         String?");
  });

  it("enum LifeEventType menutup kejadian keluarga inti", () => {
    for (const t of ["BIRTH", "DEATH", "MARRIAGE", "DIVORCE", "PARTNERSHIP", "ADOPTION"]) {
      expect(text).toMatch(new RegExp(`enum LifeEventType \\{[\\s\\S]*${t}`));
    }
  });
});
