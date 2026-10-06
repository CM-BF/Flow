# W01 official Thread revision provenance

The user rejected the original visual delivery because it used low-level primitives without the complete official Thread element. This revision replaces that shell with actual registry source; it does not rename the earlier component.

## Sources and versions

- Local discovery: `/Users/citrine/.agents/skills/find-skills/SKILL.md`; local assistant-ui, ai-elements, clean-code, frontend-design, codebase-design, brainstorming, vercel-react-best-practices and webapp-testing skills. Existing approved user direction supplies the design authorization; no new approval gate was introduced.
- assistant-ui local skill: `assistant-ui/skills@139674dc888ee076982b6726e8e6f5d0fe0b5f67`. Read the official [llms index](https://www.assistant-ui.com/llms.txt), [Thread element](https://www.assistant-ui.com/elements/thread), [external store runtime](https://www.assistant-ui.com/docs/runtimes/custom/external-store), and [elements skill](https://www.assistant-ui.com/.well-known/agent-skills/elements/SKILL.md).
- Actual installed runtime: `@assistant-ui/react@0.15.23`, `@assistant-ui/react-markdown@0.14.18`; exact other versions are in `apps/web/package.json`.
- Actual copied Thread: [official registry](https://r.assistant-ui.com/thread.json); original file SHA256 `64cb85b4076644dd319325b319264ec8e998e619a97c19e0f001d3fa5a03a016`; registry JSON SHA256 `aa3f0f355ad009e59cb89407d917cb792af9766a5b1b0d40b33c8edab75bb069`. All original downloaded JSON plus per-file hashes are in [upstream/manifest.json](upstream/manifest.json).
- Official repository reference: `assistant-ui/assistant-ui@64277e2781ac0b65eb34b45bf0fad1f371e7b2d7`; newer repo Thread has built-in earlier-history support that published runtime/registry 0.15.23 does not yet expose. The compatible registry source is the implementation baseline. Default theme CSS comes from `templates/default/app/globals.css` at that exact commit, preserved in `upstream/default-globals.css`.
- Copied dependencies include official attachment, markdown-text, reasoning, file/image, media player, tool fallback/group, follow-up suggestions, tooltip button and surfaces; shadcn registry Button, Collapsible, Dialog, Tooltip, Avatar, Skeleton, Textarea. Original source remains reviewable in captured JSON. MIT notices are retained in `apps/web/THIRD_PARTY_NOTICES.md`.
- AI Elements Terminal/FileTree were independently implemented and explicitly cherry-picked from `codex/web-workspace-panels`. Source is `vercel/ai-elements@6a9d5b1822ffb10bba4bd97175f01edd7d8651cd`, Apache-2.0. See [panel provenance](../workspace-panels/provenance.md) and its separately scoped [independent review](../workspace-panels/review.md).

## Necessary adaptations

| Adaptation | Reason |
| --- | --- |
| Relocate `@/` imports to relative paths | Root TypeScript configuration is shared and outside W01 write scope; copied app-local source must typecheck without root aliases. |
| Official default CSS; local system fonts and local Tailwind scan | Avoid Next/template monorepo assumptions while retaining default light/dark palette and styling. |
| `beforeMessages`, `composerHeader`, `footer` slots | Public Flow earlier-history pagination, backend/scenario controls, and authoritative manual-decision/status footer. Root→Viewport→Messages→ViewportFooter→ScrollToBottom→Composer remains the official structure. |
| Earlier-history handler preserves viewport offset and puts focus on viewport after the load button disappears | Published runtime lacks current-main `hasEarlier/onLoadEarlier` API. No unsupported runtime prop is invented. |
| New-task official Composer calls `projection.submit` | Center owns durable acceptance and idempotency. On an ambiguous failure the cleared composer is restored only if the user has not typed a newer draft. |
| Accepted task hides composer; no edit/reload/attachment capabilities | The public Flow contract lacks append, edit, regenerate and attachment upload endpoints. There are no fabricated callbacks. Capability-gated controls stay hidden. |
| `autoFocus=false`; Escape cancellation disabled; pending send has a disabled acknowledgement indicator | Running-state changes must not steal decision focus; cancel must remain the explicit Flow confirmation action. |
| Flow reference Tool UI + flat ToolGroup slot | Reference entries are center-issued pointers, not executable tools. Only this grouping slot is adapted; the full AssistantMessage is still official, with native Markdown and copy/action bar. Opening a reference loads detail in the right workspace. |
| Compact shell around Thread | User's Arc-style 34px chat rows, 48px activity bar, Codex-style split/merge tab groups and right workspace. Narrow targets increase to 38/40px. |
| Semantic theme registry and reduced-motion override | Retain official palette while allowing optional semantic token overrides; disable CSS motion when the user requests it. |

No follow-up, regeneration, PTY, arbitrary filesystem or plugin host capability is claimed. `data-extension-slot` names mark future plugin placement. Center facts remain in the shared FlowClient projection; local stores hold view layout, drafts and caches only.

## Collaboration boundary

Root researched and independently reviewed read-only; execution manager coordinated scope and constraints; W01 owner writes this worktree. Panels owner wrote only its independent workspace component directory and evidence, then W01 explicitly cherry-picked each submitted commit. Model dispatch was `gpt-6-astra / ultra`; runtime does not expose a separate model-verification endpoint. No lower-tier worker was delegated project writes.
