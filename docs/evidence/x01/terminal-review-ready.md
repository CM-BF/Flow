# Terminal report-only recovery review

Fixed source `20b143f847ea44d3f8e22a1e5b9229f62e2e5b86`; [manifest](terminal-review-ready.json), [local record](terminal-local.json), [Interface](terminal-outbox-interface.md). Four product paths. Compare outbox/runtime to fixed main38110485 (P02 preserved), not old sparse parent outbox. Six exact overlays reuse immutable public-runner closure, no new dependency install.

11/11 selected,7unselected; types0. Six new cases plus four directly affected existing runtime cases and one steering barrier. Two finalabsent/EOF processes,110B raw, own roots closed; initialEPERM/peak/wholewall unknown retained. No actual npm,PG or providers in this local slice. Earlier real public npm1/1 and main38110485 acceptance remain separate.

Review batch capture before HTTP; complete ACK -> admission fsync -> pending unlink; same fixed event replay after ACK loss/journal failure/post-journal crash; stale owner retained and no reinvoke; old pin survives current material change; unknown invocation remains blocked. New commit restores reviewed main P02 outbox baseline before its small delta. Only actual changed product four paths are proposed; review/input mirrors are not product overlays.
