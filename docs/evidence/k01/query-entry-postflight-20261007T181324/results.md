# K01 integrated failure-observation caller: local only

Source b6feabeb451d59cdc84c3386b2a20c97befe2db6 passed29 selected cases:11 new caller phase/identity/once-only behaviors,11 affected existing caller behaviors,7 fake-pool readonly observer cases. Three serial supervised children all exited0 with final owned-group absent, exact MERGED EOF, no first/secondary/signal faults and exact temporary-directory deletion receipts. Supervisor762ms/operator1039ms; raw750B. No new red run or actual PG/HTTP/provider operation occurred.

This delta changes Python/MJS only. MJS syntax/behavior was exercised by Vitest4.0.18 and Python3.13 by unittest. No typecheck rerun was needed or claimed; prior TypeScript noEmit remains historical. All executable bytes match the actual three run snapshots.

Primary failure is saved before an optional independent observation. Synthetic tests cover common absolute deadlines, known timeout versus unknown ownership, identity missing/change/hardlinks, exact receipt bindings, time/storage reserves, exclusive intent with spawn failure, child cleanup avoiding duplicate observation, mismatching/empty observer results, and output flush crossing deadline. Fake-pool tests cover zero/positive/absent/mismatching identity, query plus close errors, idle pool error, and unsafe input refusal. No actual scheduler, Fastify or PG lifecycle is proven.

Future150s is a new candidate, not an extension of either spent120s run. The original70work/40cleanup remains; child result/primary stop/one readonly observer/parent receipt each retain their own10s at common-origin cutoffs120/130/140/150. OS/fsync failure may still leave UNKNOWN/KEEP. Database zero connections is momentary and does not grant DROP or cleanup of retained scratch. All earlier failure/raw/recovery remains immutable.

Final target 74934ecd9fd8e33f2c83e858dcc3e1b4e343581c differs from execution only in README/metadata: primary18 plus observer1 may overlap server-side connections after client-process closure. Future admission must explicitly reserve19 or extra observer headroom; no new runtime/peak evidence is claimed.
