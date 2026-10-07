# Trusted migration observation policy

The assembly at `current-migration.mjs` now accepts two explicit in-process dependencies. Existing callers retain `validateCurrentMigrationInput` and `observeCurrentInstallation` without changed validation, filesystem access, locking, copy, retention or unknown-result semantics.

- `loadCurrentMigrationModules(input, { validateInput })` invokes the supplied validator before any I/O, then still fully verifies the selected old `expectedBackendArtifact`, source repository and exact root before importing its preview/process/pg dependencies.
- `migrateCurrentArtifact(mod, input, healthy, { validateInput, observeInstallation })` validates before checking the owned run directory. It passes the observer to `currentMigrationIO` and the original `migrateWithLocks` procedure.
- `currentMigrationIO(mod, input, run, healthy, { observeInstallation })` uses that same observer for the original lock-protected before/after reads and the final pre-rename checkpoint. The existing runner SQL confirmation, private-file comparison, all-artifact retention verification, source verification, CoW copy, fsync and no-replace rename remain unchanged.

JSON does not select functions. The separately reviewed fixed recovery caller owns the held23/b692 policy: exact old cd27/source04da, all old groups stopped, same operation and CAS, six private byte/identity pins, new b692/f37 and three-to-four retained set within2GiB. This module change does not approve that policy or any personal operation. Unknown observations propagate before later mutation; no retry or rewrite of previous inputs is added.

Four direct cases cover the old strict input, validator rejection before I/O, exact observer forwarding/unknown preservation, and the public migration wrapper invoking its trusted observer inside the original preview lock before SQL/store actions. They use only synthetic objects and a self-owned empty temporary directory. Source `000490019`, local111ms/raw588B; process group absent, dual EOF, exact empty scratch removed. No PG/provider/personal access. Prior successful store/clone cases are unchanged and were not repeated.

Clean-code review: retain one lifecycle owner and one copy/retention implementation; expose only the two dependencies required by the real held recovery consumer. No alternate loader, JSON strategy registry or second commit protocol.
