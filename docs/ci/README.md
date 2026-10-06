# CI template (not activated)

`check-workflow.yml` is a reviewed local template, not an installed GitHub Actions workflow. The current OAuth credential rejected a push containing `.github/workflows/check.yml` because it lacks the `workflow` scope. The template is retained here so ordinary application/documentation branches can be shared without requesting broader credentials.

Local `pnpm check` and isolated database/end-to-end checks remain the current evidence. Activation under `.github/workflows/` requires an appropriately authorized future action; do not claim remote CI has run.
