# Connection production composition

Fixed target: `9406ca5f2aa5a88dbc028d64e09f48f438bd627e`. Parent: WPF-MATURE-06. Shared factory delegates all HTTP/SSE authentication to the approved browser-session module. Migration028 completes after027 and before package worker, scheduler or default queue scans. Routes are mounted after the one role/authentication hook; SSE uses the same port on every read/publish cycle. There is no second cookie/role authority.

`ServerOptions.browserSession` is trusted host input `{cookieOrigin, trustedOrigins, authEpoch}`. Absent keeps sessions unsupported while legacy owner/runner Bearer remains available. Domain strict validation remains authoritative. When enabled its bounded exact CORS policy supersedes the old single `allowedOrigin` setting; credentialed wildcard origins are not introduced.

The real process entry reads optional `FLOW_BROWSER_SESSION_JSON` (nonempty valid JSON, at most4096 UTF8 bytes, then domain schema). Example for an owned loopback deployment: `{"cookieOrigin":"http://127.0.0.1:4310","trustedOrigins":["http://127.0.0.1:4310"],"authEpoch":"deployment-1"}`. No secret belongs in this object. Existing DATABASE_URL/FLOW_TOKEN configuration is unchanged. The personal installation was not changed or enabled.

## Deployment boundary

The factory starts ordinary HTTP and does not trust proxy headers or configure TLS. The actual production journey is loopback HTTP. The module's HTTPS cookie-policy test does **not** establish a TLS-terminating reverse proxy deployment. Remote direct TLS/explicit narrowly trusted proxy integration remains open; do not use `trustProxy:true` or spoofed Forwarded/X-Forwarded fields as a shortcut. Real HTTP Host/Origin forgery is rejected in the production test.

## Evidence and failures

New production cases: default unsupported/028/no identity and old roles; actual public FlowClient + HTTP/PG cookie session identity across restart, CORS/CSRF/explicit bad Bearer/Host guards, logout terminates SSE while task remains running; real Node entry configured start and malformed JSON rejection. Cookie behavior is an explicit Node test jar, not a browser-engine cookie acceptance test. Three existing default queue lifecycle cases pass unchanged. Domain22 cases are not rerun.

The first red run found absent routes/migration/startup handling. Its malformed-config child still served because the old entry ignored the variable; operator sent TERM only to owned PID58700, parent54946/54934, yielding graceful0 and preserving the failure (not an autonomous startup rejection). Random DB cleanup succeeded. The test now bounds that observation before stopping its own child. First post-change run: claim fixture expected an incomplete object and Node fetch did not preserve forged Host. Corrected exact claim shape and used real node:http for Host. Next run: a test used nested task.status instead of public TaskSnapshot.status; production unchanged. Both failure logs remain. Green2 has2 passed; final focused run has1 passed/2 unselected; root types0. No single combined3/3 run is claimed.

All four production-run random databases record before[], createdtrue, connections[], remaining[]. Successful entry PID exits0. No provider or personal operations, no user tab changed. Existing queue consumer owns its separate random database and normal cleanup, without a separately captured preflight manifest.

Clean-code/codebase-design safe point: composition owns startup and delegates policy, no duplicated authorization branch. Interface separates read/probe vs explicit connect/logout; errors and unknown ACK remain transport facts. No performance claim. Skills reuse follows existing F01 local find-skills/codebase-design/clean-code records.
