# Cleanup root identity Interface

This bounded repair uses the existing sampled inventory and OPS14. It adds no cleanup service or second supervisor. Only the canonical parent helper is authored; AV and VAR consume identical fixed bytes. Root identity, canonical path and non-symlink directory are checked before first deletion and each operation. Redirected or out-of-root paths fail closed. Final lstat accepts only ENOENT; unknown errors preserve failure. This remains cooperative pathname checking and is not an atomic hostile-filesystem sandbox.

The four meaningful direct filesystem cases cover normal cleanup, root swap before the first delete, swap between deletes and unknown final absence. Each runs under a new owned test container; no historical root, PG or service was accessed. Raw includes initial OPS14 EPERM observation; final absence and EOF are separate facts. No old case/types/list/PG was rerun.

Skills: reuse installed find-skills method and local codebase-design/clean-code baseline; no installation or network. Clean-code review kept inventory/removal ownership together, a small explicit failure interface, no fallback or silent success. Naming/error/dependency/duplicate checks were performed at source seal. Tests extract only the three functions to avoid importing the full PG operator.
