# Lazy reasoning selected reads — first Interface

This is the authorized design for MATURE06-LAZY01 under WPF-MATURE-06-03; no product implementation or run in this setup. Fixed base9816e87a7690d7d36ac25cb8537bc9c8f41364c8. C02 candidate8ee333315b5cd6a5e00bea8bf45b453e7ba70395 / SHA14429d7911e745198fd3816d42499a67569b097e4da714672cb678cfea9472ff and Web research SHAecbb9c7afdce05e8d763afe0d68f85ba6d71bbdefbd5c760aa79d8e783fa7a14 are design inputs, not implementation approval.

## One existing Module and exact responsibilities

| Module | Responsibility / Interface |
| --- | --- |
| contracts assistant-stream.ts | Add finite `patch-v3` selected-read negotiation and request/response identity, retain v1/v2 bytes and meaning |
| server assistant-stream routes/queries | Authenticate through existing route owner; select matching durable rows before LIMIT and matching hasMore; no new storage, writer, sequence or permission |
| interaction patches | Decode selected response only when protocol/task/attempt/immutable selection match; verify original source, channel, UTF8 offsets, revisions and prefix digest |
| existing ConversationStreamProjection | Own complete light metadata plus text selection and finite explicit block selections, generation, cancellation, resident accounting; no second Web store/FSM |
| presentation | Validate full settlement partition and canonical final identity; require loaded verified bodies only for replace text, not unopened retained reasoning |

## Proposed finite wire seam

`X-Flow-Assistant-Stream: patch-v3` is a single exact header. Missing/duplicate/unknown never opts in; oldv1/v2 routes remain unchanged. Metadata v3 adds an exact `protocol: 'patch-v3'` acknowledgement; a client must see this before sending selected body reads. Old server ignoring the new header therefore fails capability verification, never silently transfers reasoning in a default lazy read.

Selection is a strict union `{kind:'text'}` or `{kind:'block',streamId:<64 lowercase hex>}`. The patches route uses exact `selection=text` or `selection=block&streamId=...` only under v3; reject malformed/extraneous combinations. V3 default selection is text. `AssistantStreamSelectedPatchPage` keeps existing taskId/attemptId/patches/nextCursor/hasMore and echoes exact protocol + selection; the new decoder matches all. Source/channel/global sequence and sealed payload hash are unchanged. Text selection includes Claude legacy text and Codex channel text; block selection is one already verified metadata identity, including task/attempt/source/native session/turn/channel in the local immutable selection key.

SQL must filter source and text channel or exact streamId before ORDER/LIMIT+1. Cursor remains last included selected runner sequence, unchanged supplied cursor on empty; hasMore considers matching rows only. Empty selected page means idle, not terminal. There is no scan-watermark reinterpretation and a text cursor never seeds a reasoning cursor. Metadata remains complete, bounded and body-free for the full attempt.

## Projection disclosure and lifecycle

Preserve old StreamPort/readPatches and v1/v2 behavior. Add optional injected selected-read and verified-block-read methods for v3 so core can be tested without prematurely modifying client index. Full public FlowClient wiring and Web official disclosure controls remain required follow-up, not completed by injected port tests.

Text starts at sequence0 independently. `openReasoning(streamId)` copies/freezes the current verified metadata identity and allocates one selection generation; it never stores external mutable objects. First open performs one existing full block GET, verifies UTF8 length/digest/source/revision/lastSequence against that response and current metadata identity, then seeds that block's PatchState at its own lastSequence. Active blocks continue only selected incremental patches; no full-prefix polling. A newer snapshot may require bounded metadata refresh, never accept a stale snapshot or infer missing content. Closed historical block stays a verified snapshot.

`closeReasoning(streamId)` aborts only that selection and evicts its body; text continues. Close/reopen creates new selection generation and revalidates from block GET. Projection dispose, connection/view/turn/task identity replacement, protocol/capability changes, attempt change, offline/hidden lifetime invalidate pending responses; a late result is rejected before publish. Use existing schedule/read lifecycle, finite selected flights, no provider loop/new durable stream. Abort stops waiting; a non-cooperative injected read's external effects remain unknown.

## Bounds and final behavior

Start with maximum8 open reasoning selections per projection and the existing metadata256 blocks/3pages, selected page8 patches/4pages per scheduling pass. One cumulative2MiB resident-body budget includes text content, opened snapshots/selected patch strings and canonical final held by the projection; count simultaneous retained representations, do not count a moved reference as a second copy or label logical bytes RSS. Maintain bounded replay receipts using existing4096 ceiling per attempt across selections. Refuse/evict reasoning before dropping final text; keep light refs on eviction; explicit reopen remains possible. Do not silently truncate payloads or auto-retry a rejected open. Transient HTTP/JSON/decoder allocations remain separately bounded by current block/patch limits and are not claimed as measured heap peaks.

Complete metadata/settlement validity is distinct from body completeness: validate full disjoint retain/replace partition/source/final digest; every replacement ID must be text and its loaded body must match metadata. Unopened retained reasoning is discoverable but not falsely marked loaded and cannot prevent valid final text replacement. Never replace reasoning with final body text.

## Required verification and staged delivery

Pure/local cases must cover strict selection + response mismatch, server SQL-before-LIMIT and matching sentinel, interleaved/reasoning-only intervals then text, late-open snapshot + multibyte incremental digest, unchanged replay rejection, immutable parameters, stale/close/reopen/attempt identity, cumulative eviction, unopened reasoning final, v1/v2 and absent capability. Mocked SQL is not actual PG validation.

Later owned real HTTP/PG fixture must record that all default responses contain0 unique reasoning-body bytes (not only hidden DOM), correct selected bytes/cursors and auth/identity, first blockGET then incremental traffic, final partition, old-server refusal and v1 compatibility. Dedicated window/DB/port/cleanup required; current setup grants none. Web/TUI consumer + actual disclosure UI integration is a separate owner handoff, pending. No real SDK/provider/native needed for this data-path slice.

Six core + three new direct tests are the requested next scope; C02 handback is known but our metadata v1 claim does not grant product write yet. Public client/barrel and Web paths remain excluded; if direct-consumer changes prove necessary, request exact amend instead of weakening old assertions.
