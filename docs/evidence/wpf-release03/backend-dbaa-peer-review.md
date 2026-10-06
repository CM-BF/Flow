# RELEASE03 backend rebinding — narrow source review

Reviewer: workspace_panels_owner (Astra Ultra). Fixed harness dbaa88fa7a5adf1da077be7739842b6e42664c26. No project writes/imports/types/tests/PG/HTTP/browser/free-space sampling or personal-service calls. Reused local find-skills / codebase-design / clean-code method; examined five source blobs and two fixed owner metadata documents. Audit contains exact hashes and observed clean heads. This is SOURCE review, never run admission.

## Conclusion

The backend source input is narrow and valid for the proposed source binding, but dbaa is **not compatible with that input yet**. One P2 preparation mismatch must be fixed by the RELEASE owner: fixture.ts:49 requires exactly one changed path, while the approved b298 implementation correctly has the store and its exact copied test; its finalized owner metadata adds eleven non-product paths. Do not disable the guard or admit arbitrary server/test/docs changes.

## Fixed input and current tuple

- Base: 362af3bac77541e5a60979326bcf4d4b8c947915.
- Implementation: b29807979a5589678a61d3fb84781950cf366396; its sole parent is exactly the base, tree 307f9ff0b7749425fc9adebeb0ea9cc44d049358.
- Metadata now committed: 0037921d12c089e6334b001545f698db067087f8; observed clean on codex/personal-history-compatibility; actual tree 1cf10d9434b0cf57d083c0e5e01b9bc8b72dc074.
- Registered real path: /Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility.
- Both changed sources are regular mode100644 blobs and byte-identical to cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd, b298, final003792 and working files:
  - apps/server/src/context-transparency/store.ts: ec4ec2defd095739b2550814cc4324e00b2bcd31ae4b899de5ed983f92126245.
  - apps/server/src/context-transparency/attachment-history.test.ts: 4ae5fb30df18062159c3de1ec86e59d2db77f147e88d65a2dfb2b3582d50d96b.
- Base→b298 changes exactly those two paths, with only three added production lines. b298→003792 changes only the eleven exact metadata files listed below/audit. Therefore there are no extra committed production changes.
- apps/server/src/index.ts SHA256 e1c4bbc0c7d78132ed9f45af527ceaf65725f31321aedbce25af0171a261fdab is identical in base/b298/003792/cde. No test entry is imported by the harness factory path.
- RELEASE actual observed HEAD d83701f81d9e0ee4d6d2c000f749ba9f7ac8e83c clean; both source bytes equal dbaa. This is an observation, not replacement of the review target.

The backend source-bindings.json newTuple intentionally still names the implementation b298/tree307f. It must not be copied unchanged into a new execution gate against current003792/tree1cf1: dbaa lines46–47 correctly reject such a mismatch. Keep sourceTarget=b298 separately, but admit the real finalized runtime HEAD/tree.

## Minimal exact allowlist recommendation

1. Pin sourceImplementation=b298 and assert its exact parent362. Assert the base→implementation changed-set equals the two exact source paths, including added test; compare both blobs to fixed cde/b298 and their SHA256/mode. Do not use a *.test exemption or a whole apps/server directory allowance.
2. For the finalized candidate, use the actual approved HEAD003792/tree1cf1 (or a separately supplied/reviewed later metadata HEAD). Assert implementation ancestry and implementation→final delta is exactly its reviewed metadata closure. A fixed literal path list plus fixed Git object hashes is sufficient; never trust a candidate-supplied manifest to expand permissions.
3. The current closure is exactly:
   - docs/evidence/svc05-history-compatibility/claim-receipt.json
   - docs/evidence/svc05-history-compatibility/interface.md
   - docs/evidence/svc05-history-compatibility/manifest.json
   - docs/evidence/svc05-history-compatibility/old-a-result.json
   - docs/evidence/svc05-history-compatibility/old-a-review.json
   - docs/evidence/svc05-history-compatibility/provision.json
   - docs/evidence/svc05-history-compatibility/quality.md
   - docs/evidence/svc05-history-compatibility/source-bindings.json
   - plans/svc05-history-compatibility/plan.md
   - plans/svc05-history-compatibility/review.md
   - plans/svc05-history-compatibility/status.md
   audit.json records hashes/modes for all eleven. They are owner metadata, not an arbitrary docs/** or plans/** exemption. Parse changed paths unambiguously (e.g. -z), reject unexpected/symlink entries. Any subsequent metadata change needs a new exact tuple/closure, not a silently moving HEAD.
4. Preserve existing absolute realpath/root/HEAD/tree/clean checks (fixture42–48), working source hash checks (51–52), factory realpath check (53–54), parent preflight and worker revalidation (sourceIdentity62 and startCurrentPreview166). Do not ignore dirty or untracked metadata; require it to be committed first.
5. sourceIdentity63–69 currently labels hashes from the local362 harness repository, while backendInput identifies the candidate factory. Preserve that distinction; optionally add explicit candidate factory/source hashes under backendInput so consumers cannot mistake the local store hash for the patched store. Do not relabel all local dependencies as candidate bytes. Current exact changed-set check already establishes unchanged committed factory/dependencies relative to362.
6. The actual factory is imported via pathToFileURL(identity.factoryPath) at fixture168, after worker verifyBackend, not copied/patched into the harness tree. Git checks are repeated observations, not atomic filesystem immutability; owner must keep the selected source frozen during a separately admitted run. Ignored node_modules/module-resolution closure was not certified here (the candidate's own metadata also marks this unproven).

## Budget, raw evidence and failure semantics retained

Read 432b→dbaa two-source diff. Changes are backend input/provenance and factory selection; resource/cleanup policy is unchanged:
- browser16,49–63: total180000ms cumulative, cleanup20000ms; history per-attempt≤60000ms; history start/stop margins1GiB+32/+16MiB, all+128/+64MiB. Existing run budgets must be complete and count toward the same180s; mkdir unique run prevents overwrite.
- browser122–139: monitoring/checkpoints precede fixture import and owned CREATE; browser184–224 keeps own process-group cleanup, unknown CREATE explicitly records cleanup error, confirmed owner marker before DROP, evidence recursive bound. No new runtime exercised here.
- browser396–403 seals both history raw results, then exits before Chrome on A failure or history-only mode; browser228–249 generates compatibility only after history+actualApp+cleanup success. A-only success is not SVC compatibility/publish permission.
- Independent hash reads confirmed all ten old history-20261006-152729-727a99 raw files are unchanged between fixed dbaa, current RELEASE tree and candidate source-bindings declared hashes. They retain both historical failures, B/Chrome NOT_RUN and compatibilityId=null.
- Existing budget3874ms spent /176126ms remaining is inherited evidence, not a new measurement. Rebinding does not reset it. No existing run was repeated.

## Scope and limitations

No formal runtime approval, no test execution, no automatic factory/import/dependency validation, and no fresh resource gate. The copied backend test is source input only; its own PG behavior was not run. Recommend source-only acceptance after the narrow allowlist fix is frozen and reviewed; execution still requires manager/Lead's actual resource/window admission and exact final backend tuple. Recovery source remains frozen throughout this independent review.
