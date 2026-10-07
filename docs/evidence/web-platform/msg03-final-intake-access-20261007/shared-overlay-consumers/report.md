# Shared Dialog consumer slice — readonly proposal

Fixed main: `6fd214eb62f269167f6af4a8390850561dc0d01c`.
MSG comparison: `e96325a7f5b4ecd00be827b2e76e13c1fbc95ed5`, production `b92470377349dea17a12d0abc244f0fed7992e33`; not current main.
SOURCE_PROPOSAL_ONLY / NOT_TAKEN / NOT_RUN. Original MATURE01-02/04, REQ22/23 and message-settings TODO11; no new task/store/framework/release dependency.

Accepted design reused unchanged: `/private/tmp/root-flow-shared-overlay-design-20261007/report.md`, SHA256 `55230a04b712471882241fcf5a2c60b38404d9f2ef4448249b7850266f4b974b`. This adds consumer/scope mapping, not another design. Exactly15 versioned source inputs (12main +3MSG), pinned in `pins.json`. Filename-only inventories do not imply review of other files.

## Actual shared consumers

`apps/web/src/components/ui/dialog.tsx:17–56`: Radix wrapper, `bg-black/80` overlay; fixed centered Content uses `sm:rounded-lg`, `shadow-lg`, `bg-background` and shared Close. Six consumer files contain eleven Content occurrences:

| Main file / lines | Surfaces | Inspected corresponding test / limit |
|---|---|---|
| `apps/web/src/execution-profiles/ExecutionProfilePicker.tsx:41,73,255` | Execution profile; locked Conversation settings; Message settings | `apps/web/test/message-settings.browser.ts:157–324`: real Picker/owned HTTP fixture, six groups including tuples/CAS/Apply/Cancel, focus, panes, long names/two390/reduced motion. Component fixture, not current production App integration. |
| `apps/web/src/plugin-integration/react.tsx:171,287` | Extensions and appearance; Project text files | `apps/web/test/plugin-integration.browser.ts:73–85`: Settings Close/Escape and plugin disable/theme fallback. Main Recovery browser `:814–821,1002–1011,1132–1184`: real Files, identity/order/return focus. Other plugin-test “Files” buttons can be workspace navigation, not this dialog. |
| `apps/web/src/recovery/binding.tsx:442–465` | Saved drafts and receipts | Main `apps/web/test/conversation-recovery.browser.ts:1264–1273`, `appearance` journey: real App saved draft, Enter open, two390 themes, horizontal extent, Escape/return focus. |
| `apps/web/src/plugin-integration/knowledge.tsx:129` | Conversation knowledge | Same Recovery browser `completeDraft`, `:1004–1011,1037–1042,1063–1082`: actual knowledge/files/recovery and material/focus checks. Inventory protection, not a reason to rerun all business flows for radius/color. |
| `apps/web/src/App.tsx:334,852,853` | Cancel task; leave protected drafts/receipts; retained chats | Actual consumers. No separately bounded visual test for these three verified in this slice. Preserve actions and retained-chat destination. |
| `apps/web/src/components/assistant-ui/elements/attachment.aui.tsx:82` | Official image attachment preview | Custom width/padding/Close,80dvh image body. Attachment-browser filenames discovered only. Do not edit official Thread/attachment for shared styles. |

This is the fixed-main import/Content inventory, not other overlay primitives or all future consumers.

## Minimum representative pair

1. **MessageSettingsPicker**, real implementation through existing `startMessageSettingsFixture` / `checkMessageSettingsPicker`. Preserve native CDP printable input, radio Arrow/Space, Apply Enter, exact tuple and live host CAS; reuse normal/long-name paths. Add geometric observations without replacing components with mocks.
2. **RecoverySurface**, mounted App through existing `appearance` journey. Covers a different long-list/scroll layout, auth-bound restore controls and permitted-invoker focus. Reuse its real-center fixture, with actual dependency/PG/Chrome budgets bound later; this is not a run grant.

**Files is the next adjacent representative**: same actual App, public Files → Project text files → Escape → visible same-view Files focus. Existing queue/textIntent/completeDraft code already supplies this seam. A bounded visual selection can reuse it after coordination; never substitute workspace Files navigation or bypass plugin activation with a mock. If Files is preferred as the second representative, use that seam and retain Recovery's existing focus regression as protection. No need for another general fixture or business POST/ACK rerun just for styling.

## Main versus MSG

At fixed main, MessageSettingsPicker has no production consumer: Git symbol inventory finds its definition and test fixture/tests only. Main `Picker:255` uses one scrollable `ep-dialog`; main profile CSS `:4,29` supplies1.5rem/1.1rem padding.
MSG adds host-controlled opening/return focus, inner body and fixed actions (`Picker:262–307`; CSS `:32–42`). `ep-settings-body` has only .15rem padding. MSG actual App journey (`browser:1261–1355`) checks Apply/Cancel in390 viewport, theme/colorScheme, full-name disclosure and Escape focus; that combobox uses selectOption, not full native keyboard evidence. These are separate fixed inputs, not permission to copy MSG App/session or claim it main-integrated.

Shared wrapper/current consumers need not wait for complete MSG. But an outer-wrapper change alone cannot claim the MSG inner scrollbar defect fixed. Include its precise CSS/handoff only when taking that defect, retaining fixed actions and full identity access.

## Smallest candidate scopes — not acquired

Core shared presentation plus representative tests, four literals:
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/assistant-ui.css`
- `apps/web/test/message-settings.browser.ts`
- `apps/web/test/conversation-recovery.browser.ts`

Records stay in original MATURE01 owner plan/evidence; manager must resolve their exact existing paths before future take. No new task/directory is proposed. Add private shared style classes and use existing tokens; preserve Portal/modal/ref/event forwarding/default Close/focus trap.

If fixing **MSG inner scrollbar spacing**, add only `apps/web/src/execution-profiles/execution-profiles.css` (fifth literal), with fixed MSG consumer input/handoff. If also implementing accepted progressive-disclosure/content changes, add `apps/web/src/execution-profiles/ExecutionProfilePicker.tsx` (sixth); preserve its existing tuple/Apply/liveness regressions. Those are optional increments, not required for shared radius/shadow/overlay. No App, Thread, attachment binding, Recovery journal, plugin session/store, shared contract/theme schema/dependency writes.

Live conflicts **UNKNOWN; future fresh check required**. No ledger called. Manager history places Picker/CSS and Recovery browser under MSG; treat them as handoff candidates. Dialog/assistant-ui.css may have theme/UI writers; history is not fresh authority. STOP → current-version amend/release → fresh take before edits. No WT or claim created.

## Affected acceptance and interfaces

- Preserve individual close hooks: Settings→trigger; Files→same visible composer; Recovery→captured permission plus live/connected/visible/enabled invoker; Picker details→close-before-navigation. Do not force focus to stale/hidden panes or remount an open dialog on theme/refresh.
- Reuse `--flow-radius-pane`, light/dark `--flow-shadow-overlay`, surface/foreground/border/ring (`assistant-ui.css:88–104,131–139`). Reduced-transparency/opaque fallback and forced-colors already exist (`:186–203`). No new plugin style capability or authority; preserve plugin theme fallback/disable semantics.
- Desktop/390, normal and same-prefix long names: title, complete identity disclosure, focus and Apply/Cancel/Close reachable; no horizontal clipping. Include short-height/soft-keyboard reachability when applicable, reduced motion. Existing images never become PASS for new styles.
- **Observe both scrollbar modes**. `scrollbar-gutter:stable` alone only aids classic reserved space; overlay scrollbars need inline-end interior clearance. Target actual scroll owner (MSG body versus main outer/Recovery/Files), avoid nested scrolling or clipping fixed actions. Record classic reservation versus overlay zero-reservation, right-edge control visibility and pointer hit area. One screenshot/property presence cannot prove both; unsupported mode stays NOT_RUN, without changing personal OS preferences.
- Preserve component/CAS/tuple and Recovery focus assertions; add affected geometry/theme/scroll checks and images only. Existing plugin Settings focus/theme test is a conditional regression if token/Close handling changes. No full green matrix, provider or performance rerun by default.

## Method / limits

Reused local find-skills discovery, frontend-design restraint/token consistency, clean-code shared interfaces and scope discipline: `/Users/citrine/.agents/skills/{find-skills,frontend-design,clean-code}/SKILL.md`. No install/network research. Static finding: shared outer styling and MSG inner spacing are distinct, so acceptance must identify which changed. No project edits, imports/tests, services, resource samples, screenshots or runtime. Release new-Web supply takes priority if it arrives.
