# Verifier runtime Interface

Private pluginExecution.verifier is an explicit opt-in with an exact detached trustedAlgorithms table. toolExecution must explicitly be true to co-advertise tools; omission leaves old v2/v3 behavior unchanged. The existing private JSON reader still caps the encoded file, so the array schema is not a promise to admit every 1024-entry representation.

v4 journal identity and qualification precede recovery and are rebound after legacy completion. Recovery and unresolved/capacity gates precede a single PROCESS open. An open failure stops with the original error; cancellation after a successful open closes it without publication/initialized/claim. No old resource is adopted or deleted.

Each verifier claim uses the existing PluginRunnerClient v4 decoder and exact identity. The immutable task prompt digest is checked, executePluginVerifier owns material/algorithm/source validation, and load/invoke authorization uses the existing stable six-tuple key and exact non-replayed receipt. Trusted-process mode dispatches invokeVerifier and never silently falls back.

Artifact + typed verification + settled completion share the existing durable outbox batch. Lost ACK retains and replays the original batch. Unsettled execution or phase ACK keeps the journal without reinvocation. Old tool and legacy admission remain direct consumers.

This delivery validates local mocked transport/host behavior and real journal/outbox/resource-opening seams. Center PG, actual verifier worker invocation, release artifact/T7, public E2E and deployment remain separate requirements.
