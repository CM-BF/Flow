# Accepted deployment boundary

The HTTPS test checks cookie header construction through the trusted authentication port. It does **not** establish that the current HTTP `createServer` supports TLS termination or a reverse proxy. The first production integration is explicitly trusted loopback HTTP. Exact `cookieOrigin` uses the actual request protocol and Host; Forwarded/X-Forwarded headers are not a trusted input, and this slice does not enable `trustProxy`.

HTTPS/TLS or proxy deployment requires a separate explicit host configuration and actual transport/browser verification. No wildcard CORS, inferred forwarded origin, or relaxed host binding is introduced to make an unverified deployment appear available. Cookies still have no port isolation.
