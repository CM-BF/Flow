# Browser-session client

Shared transport owns only request authentication. Existing `{baseUrl, token, assistantStreamProtocol?}` remains Bearer. Mutually exclusive `{baseUrl, browserSession:{csrfToken:()=>string|undefined}, assistantStreamProtocol?}` uses browser-managed HttpOnly Cookie via `credentials:include` on HTTP and watch; no fallback to a stored owner token. Unsafe methods require current 64-hex CSRF from that port. Missing CSRF fails before sending, not as a center rejection.

Methods: `browserSession(signal?)`, `connectBrowserSession(ownerToken,signal?)`, `logoutBrowserSession(signal?)`. Connect is one explicit attempt with per-call Bearer plus credentials; token is not retained in the client. A lost connect ACK is unknown; use session read to observe existing state, never auto-retry connect. Logout validates unauthenticated receipt and has no task cancellation behavior. Stable command keys/body remain unchanged; unknown ACK must preserve intent in consumers.

Domain DTO is fixed31824d8. Web owns UI/session lifecycle and reads CSRF after refresh; center owns expiry/revocation/origin/role. CLI continues old Bearer. New-provider/domain policy is not inferred by transport. Ordinary reads and SSE use the same authentication constructor.

Validation:3 new real HTTP/SSE cases plus51 existing client/ACK cases passed; root noEmit exit0. Credentials option is observed at real Node fetch, not claimed as browser Cookie/CORS validation. No PG/provider/personal service used.

2026-10-06 13:36:51 UTC: P2 revision d6d5089c680f862e34a8e4d25f8f65d03057e70e explicitly uses credentials:omit for Bearer HTTP/SSE; cookie and explicit login remain include. Fixed5be historical checks did not prove browser default cookies were absent; reviewer found this configuration gap. Original red remains, only1 selected newred then3 localgreen andtypes0; no repeated PG/domain acceptance.
