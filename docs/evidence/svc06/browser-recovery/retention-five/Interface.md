# Fifth backend retention item

REQ19 / SVC06B-06, bounded existing flow approved by Execution Lead. Single owner assignment_review (gpt-6-astra), same backend-browser-recovery worktree. No new execution authority.

`LIMITS` remains the only capacity configuration. `assertBackendRetention({count,bytes}, addition)` remains the shared Interface: maximum **5 artifacts / aggregate 2 GiB / individual 1 GiB**. Unknown/non-integer quantities or unknown admission mode refuse; a sixth artifact refuses even when its bytes would fit. No deletion or automatic retirement is introduced.

`prepareBackendArtifact` holds the existing store lock, verifies all retained manifests, returns an already verified matching artifact unchanged, and reserves the entire individual 1 GiB for a new build. The known historical four sum to 1,467,477,371 B; adding this reservation reaches 2,541,219,195 B and must still refuse. Build in a separate empty store; do not mislabel an unfinished build as a verified import.

The unchanged `currentMigrationIO(...).stage(...).inspectStore()` is the direct import consumer. It verifies the exact retained set and candidate before using the candidate's actual total bytes; its lexical backend import must resolve to the reviewed capacity version. An illustrative 367,000,000 B fifth artifact would total 1,834,477,371 B, below 2 GiB; actual byte count, namespace, identity, current policy, resources and migration inputs remain future gates, not inferred from this example.

Focused checks exercise pure capacity boundaries, the real public prepare reader over five tiny owned legacy manifests, and the actual migration store port under the real store lock using tiny owned artifacts and real inventory verification. Fault ports cover verification unknown, NaN totals and aggregate overflow. No PG, actual build/install, personal state or retained installation is accessed. Existing published artifacts and all historical evidence remain immutable.

Skills: local `/Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,clean-code}/SKILL.md`, reused without installation. Bounded design was explicitly settled by Lead before implementation. Review focuses on single policy authority, unchanged Interface/ownership, fail-closed errors and direct consumer behavior; no new strategy framework or supervisor.

Independent review and main intake are pending. SVC09A may consume fixed code after review; this work does not claim a new artifact, cold startup, mixed-queue or settings activation result.
