# R3 fixed test-validity peer — source only

Target **7615ce4b89e290c42917f91f0a119c14e95e27d8**, base **35bbe76faa2128d5c1d00711fb2be3b23d54fc4f**. Only the two fixed fixture/browser blobs and their delta were inspected, reusing the already-pinned Radix modal source. Full source hashes in audit.json. Local find-skills/clean-code methods reused: trace actual fixture authority, network reader, state transitions and locator visibility separately. No imports, tests, HTTP, resource sampling or project writes.

## P2 R3-MODAL-HIDDEN-PANE-LOCATOR

`apps/web/test/message-settings.browser.ts:214` asserts the retained textarea using `left.getByLabel("Draft left", {exact:true})` while the modal opened at208 is still present. `left` is the default-hidden-excluding `getByRole("region", {name:"Pane left", exact:true})` at74. The fixture's Pane is outside the portalled Dialog. The already-pinned Radix Dialog1.2.0 source (SHA e32c21a189358f22749c171f666bddea31ae2ebe5e8c4d6c5c8aedd3916a04d7) at163–166 runs `hideOthers(content)` for modal content; this makes the underlying Pane absent from the default role query. This assertion can therefore time out before the intended Load More at216, even with correct retained text. It is a concrete locator/control-flow issue, not an observed product failure.

Minimal repair: retain the same exact value assertion, but address the uniquely aria-labelled textarea directly with `page.getByLabel("Draft left", {exact:true})` for this noninteractive observation, or use an explicitly `includeHidden:true` exact Pane locator for that observation only. Do not close the dialog, select first/nth, or weaken the material/commit assertion. The analogous final230 check occurs after Apply closes the dialog and does not have this modal visibility problem.

## Local dependency proof for the locator finding

Exact paths/hashes are in audit.json (resolved directly from b5's pinned Dialog/@playwright/test packages, no package scan or import):
- Radix Dialog1.2.0 `dist/index.mjs:163–166`: `if (content) return hideOthers(content);` (SHA `e32c21a189358f22749c171f666bddea31ae2ebe5e8c4d6c5c8aedd3916a04d7`).
- Declared `aria-hidden`1.2.6 `dist/es2015/index.js:124–134` implements hideOthers using `applyAttributeToOthers(..., 'aria-hidden')`; `:79` sets `node.setAttribute(controlAttribute, 'true')` (SHA `6a644a5eb6f1a5a59948f72f0a5c8dd08ae882420d520a63609b1ce9e13a4c22`).
- Playwright-core1.63.0 `lib/coreBundle.js:4999–5010` defaults role options to `{}` and emits include-hidden only if explicitly supplied. Its bundled injected-source string at physical line19837, `packages/injected/src/roleSelectorEngine.ts` queryRole, contains `if (!options.includeHidden) { const isHidden = isElementHiddenForAria(element); if (isHidden) return; }`. The same embedded roleUtils function `belongsToDisplayNoneOrAriaHiddenOrNonSlotted` checks `aria-hidden` and recurses through parents. Thus hidden ancestor applies to the Pane role locator, not just the input. Bundle SHA `549070af3acabb3efcc4f55bfe6210f9f7c2fcf633cf7eaa59bfe60719969171`. This is actual installed source evidence; runtime DOM was not inspected.

## Intended R3 sequence is otherwise real in source

- Fixture88–95 changes the current authority to exact profile21 and remounts keyed panes as a new draft owner; it does not inject a fabricated C/A/B. The public FlowClient→catalog path remains fixture75–77.
- Browser192–205 first refreshes the same HTTP catalog, loads the next page and establishes C/A then C/B through actual radios + Apply. The two frozen snapshots both explicitly assert profile.id21; commits reaches2. `showLarge` persists from the previous scenario, so the unchanged HTTP handler53–55 returns first1–20, then21–40.
- Browser208–215 refreshes back to first20 while retaining the already-applied C/A/B/text. It asserts the authorized profile missing message, disabled Apply and only the explicit-omit radio—no first-page profile fallback. The textarea locator is the sole blocking source issue above.
- Browser216–226 uses the real Load More control and asserts exactly two new GET paths: head without after, then after=id20, both limit20 and connection2. It checks only omit+profile21's two tuples, no id1 long-model tuple; C, commits2 and host generation remain unchanged, preventing an automatic append-time write.
- Browser227–230 stages profile21's standard tuple, checks C before Apply, then asserts commits3, C equals originalA, frozenA/B and text unchanged. This is exactly one explicit post-page Apply in the source design. It repairs the previous coverage gap rather than merely relabelling the old32-choice case.

Conclusion: **CHANGES_REQUESTED_TEST_SOURCE_SCOPED** for the single modal-hidden region locator. Pagination/authority/Apply logic has no other concrete source finding in this bounded pass. Nothing was run; no browser PASS, fullfeature approval or new acceptance requirement is implied.
