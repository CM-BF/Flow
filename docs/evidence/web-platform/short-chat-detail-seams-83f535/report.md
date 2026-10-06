# MATURE01-03 / CHATREAD — detail-entry presentation seams

Fixed main object: `83f535b54f2390a729f02bc818e07ba684d94ccb`. Five project source blobs are hashed in sources.json. No Recovery working tree was read. This is bounded read-only research for the existing acceptance record: no task/claim, implementation plan, source edit, import, test, page/API/service/PG/provider call or resource sample. Only this temporary directory was written. No dynamic behavior or visual dimensions were measured.

Local skill discovery found existing find-skills, clean-code and codebase-design; reused them without installation/network. Method: follow rendering and command authority, distinguish a small presentation seam from another state/permission authority, and keep exceptions actionable. This is a structural presentation review rather than a new visual design or frontend build.

## Conclusion

The existing message footer is the viable always-discoverable per-turn seam; MessageActions is not an always-visible status/diagnostic surface. A single detail entry can organize the existing contributed panels/actions while preserving their original message contexts and PluginView/ExtensionSlot authorization paths. It must not become a replacement task controller, a direct renderer bypass, a second data loader or an unconditional blanket collapse of every plugin.

The ordinary completed short reply should retain its actual body and at most one discoverable execution-detail affordance. Repeated ordinary success explanations/navigation affordances can live behind that affordance. Current genuine errors, unknown/unconfirmed state, blocked/retry/input-required actions and shortened/nonfinal content remain discoverable without needing to guess which closed section hides a problem. This is an acceptance direction, not a claim that the current generic plugin contract already supplies all summary/urgency metadata.

## Exact existing paths

### 1. MessageActions: contributed action labels and execution

`plugin-integration/react.tsx:112–119` derives the current message ID/role and task via ThreadScope.messageTask (or the scope task fallback), then renders `AppSlot("chat.message.actions", {kind:"message",taskId,messageId,role})`. `AppSlot:108–110` delegates to ExtensionSlot with the same session.host/context.

`plugins/react.tsx:17–69` subscribes the slot, validates the slot/context, renders every button's **declaration.title** (`51–62`), renders contributed menus separately (`64–67`), and executes via `host.execute(commandId,args,context)` (`38–47`). Errors stay a role=alert (`68`). This is the actual rendering/dispatch path for message-slot labels; it does not make their title an authorization key.

The user-reported label **Task output** was not found as a literal in these five sources: its declaration/owner registration is outside this capped read. I therefore do not invent its contribution ID, exact command args or claim it is the same function as Open task controls. The supported fact is that a label supplied by a message-action declaration is rendered/executed through the path above. The exact Task output declaration should be confirmed by the original owner before deduplicating that action; deduplication by matching English labels or DOM text would be unsound.

### 2. Official Thread has two different seams

`components/assistant-ui/elements/thread.aui.tsx:86–100` already exposes MessageActions and MessageFooter overrides; `132–143` also exposes beforeMessages/afterMessages/composerHeader/footer. A new public slot or whole-runtime replacement is not necessary just to change host presentation.

Assistant body/error remain at `600–684`; the action footer/BranchPicker is at `686–692`, while MessageFooter is separate at `693`. Assistant MessageActions is rendered inside ActionBar (`698–705,764–765`), whose root hides while running. User MessageFooter is a full-width row outside UserActionBar (`781–807`); UserActionBar also has hideWhenRunning/autohide (`811–827`). Consequently folding a discoverable detail entry solely into MessageActions/More would make it vanish in states where users most need current information. Normal copy/edit/feedback actions are distinct from execution detail and should not be conflated with repeated technical explanations.

### 3. Footer: real user anchor, contributed panels, real exceptions

`plugin-integration/react.tsx:88–106` gets message membership from ThreadScope.messageTask. Normal task panels are only rendered for the real **user** message (`101–105`), with original kind/message/task/role context. Both panel contributions (PluginView) and button/menu contributions (AppSlot) appear in this footer. This is why several independent panels/actions can form stacked rows even when the reply itself is short. Consolidation must preserve this one real turn anchor and avoid another copy on the assistant message.

Assistant stream drafts are a deliberate exception (`97–99`): interrupted/paused/block-complete/truncated/not-final metadata is shown as a short inline status. `StreamStatusPanel:76–81` produces a real alert plus Retry reply updates on error. These cannot disappear merely because execution details are collapsed. The condition is real validated message membership/state, not a title or global currently selected task.

`ConversationActivities:55–62` already receives actual pane visibility and exact projection; `ConversationDataRenderers:35–53` separately manages display lease and only lazily activates the reply renderer when a visible truncated reply exists. Hiding a presentation affordance must not silently replace those visibility/auth lifetimes with global focus or open state.

### 4. Authorized detail rendering is already reusable

`plugins/react.tsx:191–283` keeps PluginView in control: show/activation (`218–230`), current checkView permission (`236–243`), visible loading/error/retry (`245–257`), then validated resource context and bound execute (`269–272`). An aggregated detail surface must render contributions through this interface, not call `getRenderer()` and mount the result directly or invoke a raw client. Contribution IDs plus context and host ownership remain the identity; no new parallel registry/capability list is needed.

Existing `ContributionMenu:72–163` provides a keyboard-accessible action group (open/focus first, arrows/Home/End, Escape/Tab close and trigger return). Existing workspace panels preserve visited renderers and use contextual PluginView (`plugin-integration/react.tsx:191–225`), so the codebase already separates navigation presentation from contributed behavior. These are evidence of available presentation mechanisms, not proof they can be composed unchanged into a universal summary panel.

Important gap to retain honestly: generic PluginView currently exposes loading/denied/render errors in its own rendered output, while contribution declarations are just grouped by kind in this reader. These five files provide no general urgency/summary contract allowing a parent to know that an unmounted arbitrary panel contains an error. Therefore wrapping all panels in an initially unmounted disclosure and promising all errors remain visible is not justified. Known owners must keep their existing real actionable summary/recovery outside the collapsed technical details or expose a minimal private presentation seam from their existing snapshot; do not parse child DOM or invent a second status mapper. The exact owner interface is for later authorized work, not designed here.

### 5. Output/body reads must remain explicit and bound

`data-renderers/flow-reply-detail.tsx:25–37` creates an identity-bound authorized port; isCurrent checks the bound signal before and after read. The identity includes connection/view/conversation/message/turn/task/detailKey (`7–15`). `FlowReplyDetail:71–80` only binds the current assistant message with matching identity. `BoundReply:58–68` has no automatic read effect: explicit expand invokes read, and cache absence/error has an explicit read-again/retry action. Thus opening an aggregate execution-details surface should not automatically expand/read full reply or load every reference. A shortened reply's warning and accessible Read full reply action are body completeness, not redundant success chrome.

`plugins/builtins/workspace.tsx:24–39` delegates tab navigation to `flow.workspace.open`; `41–68` only loads a reference after validating that it belongs to the currently displayed task, then delegates to `flow.reference.load`. `WorkspaceAdapter:76–115` checks workspace resource membership before exposing task/details and runs explicit callbacks through execute; mismatch/error remains visible. Keep that behavior when a detail entry links to workspace. This review does not establish the upstream Task output declaration's chosen tab or exact command; no handler should be reconstructed from its title.

## Candidate acceptance refinements (not executed)

- Ordinary succeeded turn with a short complete reply: body and composer remain primary; only one discoverable per-turn detail entry, no repeated success summaries or duplicate same-target navigation. Measure actual closed/open rectangles at the existing1280×720 and390×844 fixtures; do not predeclare a saved-height percentage.
- Running/paused/failed/unknown/input-required and interrupted/truncated/nonfinal reply: necessary truthful status/action remains visible while technical IDs/protocol/page details are collapsed. Task succeeded must not be relabeled as verification passed or instruction consumed. Parent is independently checking Activity/Queue; this report did not reread or certify those controllers.
- Disable/revoke/remove a plugin while details are open, then reconnect/change pane: no direct renderer or command bypass; original host permission and exact message/task membership still control every action. Authorized sample contributions remain discoverable; different contributions must not be deduplicated merely for sharing a label.
- Collapsed surface opens no full body/reference. Opening the outer surface alone does not prefetch all details. Explicit full-reply/reference actions preserve cache/re-read and error behavior, with no cross-pane or stale-identity response adoption.
- Keyboard can discover the entry without hover, open/close it, and reach each contributed action. Escape/close restores the originating trigger. An action navigating to a real task/workspace closes any blocking overlay and gives focus to the correct target; it must not leave the destination behind an inert modal. Check both themes and two visible panes with independent disclosure identity.
- Empty Center queue should not dominate an ordinary reply, but this bounded read intentionally does not certify queue truth/error behavior; root's separate Queue audit remains the source. Do not hide unknown receipt/recovery state to achieve the empty-layout objective.

## Limits and handoff

Five fixed project files only; exact hashes in sources.json. No dynamic screenshot inspection by this reviewer, no running Recovery source, no measurements or tests, no implementation/scope proposal or new authority. The uninspected Task output declaration is an explicit trace limitation, not a guessed equivalence. This report is for original MATURE01-03/CHATREAD acceptance; it does not complete that task or approve a change.
