# Validation

Fixed implementation: `a8b2b22a29bc3fb6ebd5252754d1e1cdbc975231`; root independent review is APPROVED (scope and attribution in canonical review). All source/test bytes in [binding](source-binding.json) match both final reports and the current tree. Author checks are not independent reviewer checks.

| Check | Actual result / source |
| --- | --- |
| Existing PluginHost direct consumer | 17/17, [raw](plugin-host-direct.log); covers contributed theme disable fallback and existing host lifecycle |
| Web typecheck | exit0 [raw](split-typecheck.log) |
| Production build | exit0 [raw](split-build.log); pre-existing large-chunk warning retained |
| Development actual App | 8/8, [raw](lower-focus-development.log), [report](development-browser.json), pageErrors=[] |
| Production actual App | 8/8, [raw](lower-focus-production.log), [report](production-browser.json), pageErrors=[] |
| Baseline actual App | same first journey, [raw](baseline.log); only the two CSS files temporarily overlaid from base, restored in finally |

The eight journeys cover empty/long Markdown/code/table at1280×720 and390×844, four themes and real reload persistence, plugin palette and disable fallback, lazy Tool/Reasoning keyboard expansion, independent split/stream drafts, explicit queue error and keyboard focus in narrow themes, unsupported CSS branch and reduced-transparency/forced-colors fallbacks. The final error assertion requires the real `Fixture unavailable` alert, rather than merely matching a refresh label.

Actual measured pane outer sizes (same fixture, not a performance measure): desktop996×676→984×672, narrow342×800→334×798. The difference is the inset gutter/border; pane radius0→14px, opaque reading surface and subtle shadow. No document horizontal overflow in these measured scenes. Baseline is fixed CSS overlay on the same App/fixture, not an entire separate baseline build. Long tables can still scroll locally when content requires it; this fixture's three columns fit after the narrow type/padding treatment.

## Failures and corrections

- [Theme typecheck](theme-typecheck.log): generated activation-event array inferred string instead of template literal; preserved literal type and reran Web tsc successfully.
- [First browser](browser-first.log): test expected sidebar after it was intentionally hidden; the material assertion now uses the always-present rail.
- [Second browser](browser-second.log): the test omitted the existing More actions menu trigger; corrected to the real two-step UI.
- [Third browser](browser-third.log), [raw report](third-development-browser.json), [failure image](third-development-failure.png): **real CSS regression**. Glass created a stacking context and sidebar intercepted extension-menu clicks. Rail now has explicit bounded z-index40 below the modal's50; actual menu/theme/disable clicks pass.
- [Fourth browser](browser-fourth.log): selector said Thought but the installed official component says Reasoning; corrected only the test selector.
- [Fifth](browser-fifth.log), [sixth](browser-sixth.log), [intermediate final](development-final.log), [narrow refinement](development-final-v2.log) retain intermediate passing runs; only the final reports claim exact candidate byte matching. Narrow table initially broke words aggressively; replaced with smaller narrow-cell type/padding while keeping local scrolling for larger tables.
- [First production](production-final.log), [raw report](production-first-browser.json): CSS minifier adds vendor-prefixed `@supports`; the fallback test's condition substitution did not match. Extended only that fixture interception to match dev/prod support declarations. No product fallback change was needed. Final production8 passed.

Raw logs are retained unmodified; full evidence whitespace checks may report their terminal blank lines or build warning trailing whitespace. Product/source and maintained Markdown must pass diffcheck. No tests were skipped or assertions weakened to accept a failure. The source's final seven hashes, including the browser script, are checked separately from historical execution HEADs.

## Narrow split review follow-up

Root raised a possible gap overflow, then the author measured the fixed be50 production App at390×844: container798px, panes399+399 plus4px gap produced scrollHeight802. The lower composer was reachable, but the4px local overflow was real. [Before JSON](review-narrow-split-before.json) and [image](review-narrow-split-before.png) preserve the observation. The first probe incorrectly opened both chats in one group; that setup assertion failed, then the corrected setup produced these measurements.

The fix subtracts the gap before dividing the minimum pane height. New final dev/prod8 both measure clientHeight=scrollHeight=798 and pane boundaries0–397/401–798. Production visible composers250.8–335.3/651.8–736.3 remain within their respective panes; both different drafts persist. The first1e299 test incorrectly assumed Conversation3 was the lower pane; it actually focused the upper pane. That report does not prove lower focus. The subsequent DOM-based test below supplies that evidence. [Production narrow image](production-split-dark-390.png); final reports include `narrow-split-bounds`. Web typecheck/build reran; unchanged PluginHost17 was not rerun. No other product paths changed.

Report provenance: first split report JSONs record be50+dirty at execution and all seven hashes match the new fixed target. Prior production report is [be50 report](be50-production-browser.json); original development JSON was superseded by the first split probe run, with the original development raw log and [be50 source binding](be50-source-binding.json) retained. The interim split development report is saved separately. No old report is relabelled as new-target execution.

Theme reload evidence is limited to the four builtins. Persisted plugin-theme restoration and plugin radius/shadow/material validation are future MATURE01 work; current contributed Ocean switching/disable fallback checks do not prove plugin reload persistence.

The final test identifies the actual last visible `.flow-chat-group`, preserves the first pane's different draft, fills/focuses its textarea, and asserts `document.activeElement` belongs to that second pane. Final development and production8/8 pass with errors[]; production input local259.78–294.78 is within397px pane, upper draft remains `A separate draft stays here`. [Prior1e299 report](1e299-production-browser.json) and [prior screenshot](1e299-production-split-dark-390.png) retain the mistaken positional-label evidence; the latest reports record1e299+dirty and match the new fixed seven hashes. This final change is test-only; the CSS/build from1e299 is unchanged.

Exact full-evidence diffcheck exceptions: build.log/build-final.log/split-build.log line21 raw warning trailing spaces; first-typecheck.log/typecheck.log/typecheck-final.log/split-typecheck.log line4 and plugin-host-direct.log line10 terminal blank lines. Maintained source/Markdown pass; raw logs remain untouched.
