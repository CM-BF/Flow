import { describe, expect, it } from "vitest";
import type { AttachmentReference, ConversationContextReference, KnowledgeCitation } from "@flow/contracts";
import { assertContextReceiptMatches, freezeKnowledgeRequest } from "../src/conversation-context/receipts";

const citation = (n = 1): KnowledgeCitation => ({ projectId: "project-a", sourceId: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`, version: 1, contentDigest: "a".repeat(64), locator: { kind: "utf8-bytes", start: 2, end: 6 } });
const context = (refs: KnowledgeCitation[]): ConversationContextReference => ({ id: "context-a", contextDigest: "b".repeat(64), executionInputId: "input-a", executionInputDigest: "c".repeat(64), templateVersion: 1, sources: refs.map(ref => ({ citation: structuredClone(ref), byteLength: ref.locator.end - ref.locator.start, currentVersionAtFreeze: 2, isCurrentAtFreeze: false })) });

describe("frozen knowledge receipt inputs", () => {
  it("preserves omitted and explicit empty inputs without adding context or normalizing text", () => {
    const omitted = freezeKnowledgeRequest({ text: "  e\u0301\r\n", knowledge: undefined });
    const plain = freezeKnowledgeRequest({ text: "plain" });
    const empty = freezeKnowledgeRequest({ text: "plain", knowledge: [] });
    expect(omitted.text).toBe("  e\u0301\r\n"); expect(omitted.knowledge).toBeUndefined();
    expect(plain).not.toHaveProperty("knowledge"); expect(empty.knowledge).toEqual([]);
    expect(Object.isFrozen(empty.knowledge)).toBe(true); expect(Object.isFrozen(plain)).toBe(true);
  });
  it("detaches every mutable citation layer and preserves selection order", () => {
    const refs = [citation(2), citation(1)];
    const request = freezeKnowledgeRequest({ text: "original", knowledge: refs }, "project-a");
    refs[0]!.locator.end = 8; refs[1]!.contentDigest = "d".repeat(64); refs.reverse(); refs.length = 0;
    expect(request.knowledge).toEqual([citation(2), citation(1)]);
    for (const ref of request.knowledge) { expect(Object.isFrozen(ref)).toBe(true); expect(Object.isFrozen(ref.locator)).toBe(true); }
    expect(Reflect.set(request.knowledge[0]!.locator, "end", 9)).toBe(false);
  });
  it("enforces exact duplicates, one project, four references and aggregate byte budget before publication", () => {
    const wide = (n: number) => ({ ...citation(n), locator: { kind: "utf8-bytes" as const, start: 0, end: 4096 } });
    expect(() => freezeKnowledgeRequest({ knowledge: [citation(), citation()] })).toThrow();
    expect(() => freezeKnowledgeRequest({ knowledge: [citation(), { ...citation(2), projectId: "project-b" }] })).toThrow("project");
    expect(() => freezeKnowledgeRequest({ knowledge: [citation()] }, "project-b")).toThrow("project");
    expect(() => freezeKnowledgeRequest({ knowledge: Array.from({ length: 5 }, (_, n) => citation(n + 1)) })).toThrow();
    expect(() => freezeKnowledgeRequest({ knowledge: [wide(1), wide(2), citation(3)] })).toThrow("8192");
    expect(freezeKnowledgeRequest({ knowledge: [wide(1), wide(2)] }).knowledge).toHaveLength(2);
  });
});

describe("context receipt acknowledgement", () => {
  it("accepts exact ordered citations even when their version was no longer current at freeze", () => {
    const refs = [citation(2), citation(1)], receipt = context(refs);
    expect(() => assertContextReceiptMatches(refs, receipt)).not.toThrow();
    expect(receipt.sources[0]!.isCurrentAtFreeze).toBe(false);
  });
  it("supports plain legacy receipts and valid empty metadata but rejects unrequested sources", () => {
    for (const refs of [undefined, []]) {
      expect(() => assertContextReceiptMatches(refs, undefined)).not.toThrow();
      expect(() => assertContextReceiptMatches(refs, context([]))).not.toThrow();
      expect(() => assertContextReceiptMatches(refs, context([citation()]))).toThrow("context");
      expect(() => assertContextReceiptMatches(refs, null)).toThrow("context");
    }
  });
  it("rejects missing, shortened, extra and reordered context sources", () => {
    const refs = [citation(1), citation(2)];
    for (const value of [undefined, context([]), context([refs[0]!]), context([...refs, citation(3)]), context([...refs].reverse())])
      expect(() => assertContextReceiptMatches(refs, value)).toThrow("context");
  });
  it("compares every immutable tuple field rather than just source ID or version", () => {
    const ref = citation();
    const variants = [{ ...ref, projectId: "other" }, { ...ref, sourceId: citation(2).sourceId }, { ...ref, version: 2 }, { ...ref, contentDigest: "f".repeat(64) }, { ...ref, locator: { ...ref.locator, start: 1 } }, { ...ref, locator: { ...ref.locator, end: 5 } }];
    for (const changed of variants) expect(() => assertContextReceiptMatches([ref], context([changed]))).toThrow("context");
  });
  it("rejects malformed context identity, digests, template and source metadata", () => {
    const refs = [citation()];
    const variants: unknown[] = [{}, { ...context(refs), id: "" }, { ...context(refs), executionInputId: "x".repeat(129) }, { ...context(refs), contextDigest: "invalid" }, { ...context(refs), executionInputDigest: "invalid" }, { ...context(refs), templateVersion: 2 }, { ...context(refs), sources: {} }];
    for (const patch of [{ byteLength: 5 }, { currentVersionAtFreeze: "2" }, { currentVersionAtFreeze: 17 }, { isCurrentAtFreeze: true }])
      variants.push({ ...context(refs), sources: [{ ...context(refs).sources[0], ...patch }] });
    for (const value of variants) expect(() => assertContextReceiptMatches(refs, value)).toThrow("context");
  });
});


describe("mixed immutable material requests", () => {
  const upload = (n = 1): AttachmentReference => ({ kind: "upload", projectId: "project-a", resourceId: `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`, version: 1, contentDigest: "d".repeat(64) });
  it("deep-freezes both material kinds without changing either order or the text", () => {
    const attachments = [upload(2), upload(1)], knowledge = [citation(2), citation(1)];
    const frozen = freezeKnowledgeRequest({ text: "  BOM-free\r\n", knowledge, attachments });
    attachments[0]!.resourceId = upload(3).resourceId; knowledge[0]!.locator.end = 9;
    expect(frozen.attachments).toEqual([upload(2), upload(1)]); expect(frozen.knowledge).toEqual([citation(2), citation(1)]);
    expect(Object.isFrozen(frozen.attachments)).toBe(true); expect(Object.isFrozen(frozen.attachments[0])).toBe(true);
    expect(frozen.text).toBe("  BOM-free\r\n");
  });
  it("enforces the joint count and project while retaining empty legacy shape", () => {
    expect(() => freezeKnowledgeRequest({ knowledge: [citation(), citation(2)], attachments: [upload(), upload(2), upload(3)] })).toThrow();
    expect(() => freezeKnowledgeRequest({ knowledge: [citation()], attachments: [{ ...upload(), projectId: "other" }] })).toThrow("project");
    expect(() => freezeKnowledgeRequest({ attachments: [upload(), upload()] })).toThrow();
    expect(freezeKnowledgeRequest({ text: "plain" })).not.toHaveProperty("attachments");
    expect(freezeKnowledgeRequest({ attachments: [] }).attachments).toEqual([]);
  });
});
