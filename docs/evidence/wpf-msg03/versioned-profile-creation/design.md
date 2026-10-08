# MSG03 / MATURE02 TODO08–11 — versioned creation foundation

Base: bfbf804bdc290ac27787a355b064457fb76bfc58. Owner workspace_panels_owner, claim fee104b3 v1 exact5. First write 2026-10-08T02:50:38.358088Z; fixed deadline 03:15:38.358088Z. This evidence is the existing MSG03 follow-up, not a new task or status authority.

The explicit versioned selection stores a strict public catalog entry, detached and frozen. CREATE freezes only its complete profile reference and the existing creation contract; it never chooses a message tuple. Recovery decodes the same branch without widening legacy decoding or inferring current catalog authority. A pure Send/Queue eligibility function requires both the selected full reference and trusted conversation capability, then the current catalog and complete allowlisted tuple. A trusted existing capability also requires a tuple even when the draft selection is legacy. Empty choices remain legal catalog data and block submission. Clear/omit stays editable.

App/Thread/Picker/session integration is NOT implemented in this exact5 scope; the future owner must call eligibility before official composer detach and use the returned frozen tuple. Existing optional capture is retained for compatibility until that integration. Neither this function nor a directory entry grants connection/view ownership. Creation-only prepare and UNKNOWN receipt replay keep their existing Projection/Outbox authority; no new scheduler, receipt or draft store.

Tests: select only new versioned creation invariants in the existing two test files. Controlled Projection and Outbox exercise UNKNOWN CREATE with exact same key/body and a separate intact draft; this is not mounted UI, HTTP, provider or native evidence. Affected static-import types cover the production changes; old green suites are excluded.

Skills: reuse locally discovered find-skills method; brainstorming narrows the explicit union and compatibility boundary, codebase-design keeps policy in one pure interface, clean-code checks names/responsibility/error handling and immutable identity. No skill install or external authority change.
