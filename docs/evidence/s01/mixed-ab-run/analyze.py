"""Offline summary of this fixed A/B record; never connects to Flow or replays work."""
import collections
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def distribution(values):
    ordered = sorted(values)
    if not ordered:
        return {'n': 0}
    return {'n': len(ordered), 'min': ordered[0], 'p50': ordered[math.ceil(len(ordered)*.50)-1],
            'p95': ordered[math.ceil(len(ordered)*.95)-1], 'p99': ordered[math.ceil(len(ordered)*.99)-1],
            'max': ordered[-1], 'sum': sum(ordered)}

summary = {'basis': 'Single fixed A then B; nearest-rank quantiles in milliseconds. Offline raw projection only.', 'sides': {}}
for side in ('A', 'B'):
    observations = json.loads((ROOT/side/'observations.json').read_text())
    result = json.loads((ROOT/side/'result.json').read_text())
    case = result['cases'][0]
    activity = case['activity']
    begin, end = activity['windowStartMs'], activity['windowEndMs']
    http = [row for row in observations if row['kind'] == 'runner-http']
    sql = [row for row in observations if row['kind'] == 'sql']
    event_http = [row for row in http if row['path'] == '/api/runner/events']
    window_http = [row for row in event_http if row['sentChildMs'] >= begin and row['settledChildMs'] <= end]
    emits = [row for row in observations if row['kind'] == 'emit-ack'
             and row['startedChildMs'] >= begin and row['childMs'] <= end]
    acks = [row for row in observations if row['kind'] == 'event-ack']
    pools = [row for row in observations if row['kind'] == 'pool-acquisition' and row['poolRole'] == 'center']
    transactions = [row for row in observations if row['kind'] == 'transaction' and row['poolRole'] == 'center']
    memory = {}
    for role in ('driver', 'center', 'runner'):
        rows = [row for row in observations if row['kind'] == 'memory' and row['role'] == role]
        memory[role] = {'samples': len(rows), 'pids': sorted({row['pid'] for row in rows}),
                        'sampledRssMaxBytes': max(row['rss'] for row in rows),
                        'processReportedMaxRssKiB': max(row['maxRssKiB'] for row in rows)}
    pg = [row for row in observations if row['kind'] == 'pg-activity']
    owner_reads = [row for row in observations if row['kind'] == 'owner-http' and row['phase'].endswith(':window')]
    journals = json.loads((ROOT/side/'journals.json').read_text())
    summary['sides'][side] = {
        'fixedProduction': result['contract']['base'], 'success': result['success'], 'errors': result['errors'],
        'totals': result['databaseFinal']['totals'], 'persistedEvents': len(case['events']),
        'acceptedEvents': sum(row['acknowledgement']['accepted'] for row in acks),
        'ackRecords': len(acks), 'windowEmits': len(emits), 'windowEmitLatencyMs': distribution([row['elapsedMs'] for row in emits]),
        'logicalAdapterPeak': activity['logicalAdapterPeak'], 'allAdapterOverlapMs': activity['allAdapterOverlapMs'],
        'earliestAdapterEndAfterWindowStartMs': min(row['endedMs'] for row in activity['intervals'])-begin,
        'commonAckEnvelopeMs': activity['commonAckSpanMs'],
        'individualAckSpanMs': distribution([row['lastAckMs']-row['firstAckMs'] for row in activity['spans']]),
        'validatedDbSamples': case['sampledOwnership']['validatedSamples'],
        'conservativeDbSampleSeparationMs': case['sampledOwnership']['conservativeSampleSeparationMs'],
        'httpCountsByPath': dict(collections.Counter(row['path'] for row in http)),
        'httpStatuses': dict(collections.Counter(str(row['status']) for row in http)),
        'httpErrors': [row for row in observations if row['kind'] == 'runner-http-error'],
        'eventHttpAllMs': distribution([row['elapsedMs'] for row in event_http]),
        'eventHttpWindowMs': distribution([row['elapsedMs'] for row in window_http]),
        'centerPoolAcquireMs': distribution([row['elapsedMs'] for row in pools]),
        'centerTransactionMs': distribution([row['elapsedMs'] for row in transactions]),
        'centerPoolWaitingSampleMax': max(row['waiting'] for row in pools),
        'sqlCountsByCategory': dict(collections.Counter(row['category'] for row in sql)),
        'sqlOutcomes': dict(collections.Counter(row['outcome'] for row in sql)),
        'sqlRunnerShareMs': distribution([row['elapsedMs'] for row in sql if row['category'] == 'runner-row-share']),
        'sqlRunnerExclusiveMs': distribution([row['elapsedMs'] for row in sql if row['category'] == 'runner-row']),
        'lightRead': next(row for row in observations if row['kind'] == 'read-summary'),
        'lightReadLatencyMs': distribution([row['elapsedMs'] for row in owner_reads]),
        'pgActivitySamples': len(pg),
        'pgConnectionSampleMaxExcludingObserver': max(len(row['activity']) for row in pg),
        'pgSamplesWithLockOrBlocker': sum(any(item['wait_event_type'] == 'Lock' or item['blockers'] for item in row['activity']) for row in pg),
        'memory': memory, 'observationCount': len(observations), 'journalCount': len(journals),
        'journalsAllEmpty': all(not row['unresolved'] and row['value']['inFlight'] is None and row['value']['assignments'] == [] for row in journals),
        'runtimeSettled': [row for row in observations if row['kind'] == 'case-runtime-settled'],
        'reporterClose': [row for row in observations if row['kind'] in ('child-settled', 'center-settled')],
        'cleanup': result['cleanup'], 'byteAccountingComplete': result['byteAccountingComplete'],
    }
summary['limits'] = ['SQL other combines many statements; no exact task UPDATE counter or isolated persistEventState timing.',
    'Pool and transaction distributions include setup/reads/heartbeat/claim/cleanup, not only event persistence.',
    'Memory is per-process sampled RSS/high-water report; driver PID is reused and B inherits prior allocations/high-water.',
    'No sampled RSS sums are a simultaneous total or hard peak; PG/WAL end growth and peak were not measured.',
    'Single A-before-B pair with observer overhead and shared host background; not randomized, replicated, latestmain, SDK capacity, or SLO.',
    'All-adapter overlap includes barrier wait; ACK envelope is not uninterrupted execution. DB proof covers sampled instants.']
(ROOT/'comparison.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps({'sides': {s: {k: v for k,v in d.items() if k in ('totals','eventHttpAllMs','eventHttpWindowMs','centerPoolAcquireMs','centerTransactionMs','sqlCountsByCategory','lightReadLatencyMs')} for s,d in summary['sides'].items()}}))
