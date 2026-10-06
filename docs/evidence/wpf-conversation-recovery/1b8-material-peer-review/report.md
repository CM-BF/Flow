# Fixed Recovery material delta — read-only review

Target `1b8a335ecf26ece7539ad19e634508ac12ca3729`; base `02d5a49aa2f17261d7dfcc9590f433c84b10defe`. Reviewer w01_owner. Method: fixed Git objects, the preceding root report, and eight exact source/plan files recorded in sources.json. Reused local find-skills/clean-code/codebase-design methods: trace authority before effects, keep ordered material membership in one private binding, distinguish source reasoning from executed evidence.

## Result

No new actionable regression established in this bounded delta. The two preceding findings are addressed at the source level. This is a narrow source review, not a full Recovery approval and not runtime admission. All new direct/browser checks remain **NOT_RUN by this reviewer**; old 20/20 says nothing about new 27.

## Findings revisited

- **RECOVERY02D-M1 (P1), source correction present:** ConversationThread.tsx:161–180 invokes captureDraft even for zero official chips, before setting pending, beginning recovery handoff or calling composer.send. attachments.tsx:165–183 derives the whole current selection from Input order, rejects unverified/no-metadata items and exact chip count/order mismatches before capture. Thus restored unverified A and partially verified A/B cannot become a plain/subset request via this entry. Input.restore (controller.ts:196–205) still deliberately produces unverified error state; browse:147–163 upgrades only a matching reference/name/type/byteLength with ready, unexpired authoritative metadata. Explicit Input.remove:216–220 removes only the selected item, without server deletion. The smaller-selection path is intentional, not automatic degradation.
- **RECOVERY02D-M2 (P2), source correction present:** syncComposerDraft (attachments.tsx:185–199) stops at the first unavailable selected item, checks composer as an exact prefix, and appends in Input order. B-only metadata verification no longer skips A to append B. After each await it rechecks lease/readability/current selection, so a removed item or revoked lease cannot resume the remaining append sequence. captureDraft independently rejects a reversed composer, rather than trusting chip order as the authority.

## Ownership/lifecycle reasoning

attachments.tsx:165–172 excludes IDs held by an earlier submission or inTransit unless those IDs are actually back in current composer. A new plain draft can therefore remain plain while a separate old failed/preparing capture retains ownership. Current restored chips participate in the full membership check. Existing capture:234–243 retains its separate failed-submission identity restriction; handoff:250–264 requires a genuinely new local receipt and exact text/intent/conversation/knowledge/attachment order before consume. This review did not broaden those pre-existing rules.

The reactive synchronization effect in Thread:148–155 remains separate from bindComposer's stable lifetime (156–160); metadata readiness updates do not release the preparation watcher. adapter.ts:36–51 reconciles public attachments + submission + inTransit, and binding:201–229 retains the prior guarded preparation/restore logic. The new code does not add another registry or replace that ownership model.

## New checks read, not executed

conversation-recovery.test.ts:109–131 exercises both Send and Queue with real binding/Input and existing command owners, stubbed transport: initial/partial verification rejects with no command/HTTP; explicit removal permits the remaining ref. Lines132–148 add B-before-A, partial add and reversed chip rejection, original ordered refs and once-only insertion. Lines150–176 cover binder explicit deletion, lease interruption, old inTransit/held material exclusion and independent plain draft. The composer here is explicitly a controlled public-state port, not the installed core or React.

conversation-recovery.browser.ts:262–336 strengthens actual-App materialDraft with two real uploaded refs, unverified/partial Send+Queue zero-command/POST assertions, B-only then A-only filtered metadata reads, ordered official chip tooltips and preserved draft journal order. The subsequent lost-ACK Send asserts the same ordered pair in actual request body. fixture.ts:151–165 adds only the second upload resource and returns it to the harness. These are meaningful source assertions, but browser scheduling/selectors, persistence and actual HTTP remain unexecuted for this target.

## Limits

No imports, typecheck, tests, browser, PG, network/provider, process/resource polling, project writes or moving-source review. Only /tmp report files were written. No claim that broader Recovery CAS/auth/namespace/log-out fixes were re-reviewed. UI callback implementations outside these eight files were not expanded; in particular this report does not turn controlled Input.remove and composer-state tests into proof of every Files/chip UI removal path. Full App run must still confirm both restored metadata synchronization and a subsequent successful ordered submission, while preserving an independent new draft.
