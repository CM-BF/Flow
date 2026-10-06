# Native catalog fixture CREATE ACK cleanup delta

Production target c9c6e891003af2fc52ca77b0c4527d6d85e20e22 remains APPROVED. This delta changes only native-catalog.test.ts and own evidence/metadata; no production behavior changes. Delta independent review NOT_STARTED.

The fixture records creationRequested before sending CREATE after checking its unique random name absent and taking its advisory lock. Cleanup first closes its HTTP server and application pool, queries only that owned name, issues ordinary DROP if present, then verifies absence. Failed lookup/drop/confirmation reports state unknown plus the exact owned name; no FORCE, session termination, retry or shared-service operation. A preparation failure before a CREATE request cannot authorize deletion.

Targeted regression executes a real CREATE on a second unique owned DB, then injects loss of the acknowledgement at the await boundary. It checks request ownership survives the rejection, the committed DB exists, and the same cleanup removes it. This is synthetic response loss after a real commit, not a real socket failure. No application connection ever opens to the second DB. The enclosing real server/DB fixture exercises its normal shutdown and exact cleanup in afterAll.

Actual Node24.20.0 / Vitest4.0.18 selection:1 passed,9 intentionally unselected; fixture-result.json exit0 and raw retained. Local strict noEmit exit0; no17 old consumers/full9/27/31/19 rerun. No real Codex/auth/provider or diagnostic child. Original manifest/raw and33 distinct claims remain tied to c9c6e891.

Commands and UTC/duration/exit receipts are fixture-result.json and typecheck-result.json. Clean-code safety point2026-10-06 10:37:43 UTC: local find-skills matches existing clean-code and codebase-design; fixed sickn33 source bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5. Checked explicit ownership names, two small create/cleanup functions, fixed non-sensitive unknown report, nested finally closure, no redundant lifecycle framework. No install or dependency changes.
