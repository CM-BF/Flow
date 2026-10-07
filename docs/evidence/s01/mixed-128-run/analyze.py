"""Offline only: derive facts from the immutable saved S01 window files."""
import collections, hashlib, json, math, pathlib, statistics
P = pathlib.Path(__file__).parent
r = json.loads((P / 'result.json').read_text())
c = r['cases'][0]
o = json.loads((P / 'observations.json').read_text())
j = json.loads((P / 'journals.json').read_text())
cli = json.loads((P / 'cli.stdout').read_text())
def rows(kind): return [x for x in o if x['kind'] == kind]
def distribution(values):
    a = sorted(values)
    return {'n': len(a), 'min': a[0], 'median': statistics.median(a), 'p95NearestRank': a[math.ceil(.95*len(a))-1], 'max': a[-1]} if a else {'n': 0, 'value': None}
def counts(values): return dict(collections.Counter(values))
assert r['success'] and cli['success'] and r['errors'] == cli['errors'] == []
assert r['tasksSentOrUnknown'] == 128 and r['databaseFinal']['totals'] == {'tasks':128,'attempts':128,'sessions':128}
assert len(c['taskIds']) == len(set(c['taskIds'])) == 128
assert len(c['gate']) == len(c['final']) == 128 and c['windowComplete'] and c['settledByDeadline']
gate = {x['attempt_id']:x for x in c['gate']}
assert len(gate) == 128 and set(c['taskIds']) == {x['task_id'] for x in gate.values()}
assert len({x['native_session_id'] for x in gate.values()}) == 128
assert sorted(collections.Counter(x['runner_id'] for x in gate.values()).values()) == [16]*8
for x in gate.values():
    assert x['live'] and x['status']=='running' and x['completed_at'] is None
    assert x['attempt_id']==x['current_attempt_id'] and x['task_version']==x['owner_version']==1
    assert x['native_session_id']==x['session_id'] and x['runner_id']==x['session_runner_id'] and x['task_id']==x['session_task_id'] and x['session_harness']=='fixture'
acks = rows('event-ack')
ackEvents = {}
for x in acks:
    assert x['ownerVersion']==gate[x['attemptId']]['owner_version']
    assert x['acknowledgement']['accepted']==len(x['events'])
    for e in x['events']:
        assert e['id'] not in ackEvents and x['acknowledgement']['lastSequence']>=e['sequence']
        ackEvents[e['id']] = (x['attemptId'],e['sequence'],e['digest'])
assert len(c['events'])==len(ackEvents)==2304 and len({x['event_id'] for x in c['events']})==2304
for e in c['events']: assert ackEvents[e['event_id']]==(e['attempt_id'],e['sequence'],e['digest'])
for x in c['final']:
    assert x['status']=='succeeded' and x['verification_status']=='passed' and x['last_sequence']==18
    assert sorted(e['sequence'] for e in c['events'] if e['attempt_id']==x['attempt_id'])==list(range(1,19))
    g=gate[x['attempt_id']];assert x['id']==g['task_id'] and x['runner_id']==g['runner_id'] and x['native_session_id']==g['native_session_id']
sessions={x['id']:x for x in r['databaseFinal']['sessions']}
assert len(sessions)==128 and all(x['active_task_id'] is None and x['harness']=='fixture' for x in sessions.values())
for x in gate.values(): assert sessions[x['native_session_id']]['runner_id']==x['runner_id']
assert len(j)==8 and all(not x['unresolved'] and x['value']['inFlight'] is None and x['value']['assignments']==[] for x in j)
assert all(x.get('exitCode')==0 and not x['forced'] for x in r['cleanup'] if 'pid' in x)
assert any(x.get('absentConfirmed') for x in r['cleanup']) and any(x.get('removed') for x in r['cleanup'])
start=rows('window-start')[0]['beganMs']; end=start+6000
enters={x['attemptId']:x for x in rows('adapter-enter')}; ends={x['attemptId']:x for x in rows('adapter-end')}
assert len(enters)==len(ends)==128 and set(enters)==set(gate)==set(ends)
for key,x in enters.items():
    assert x['childMs']<=start and ends[key]['childMs']>=end and not ends[key]['interrupted']
spans=[]
for key in gate:
    a=[x['childMs'] for x in acks if x['attemptId']==key and x['emissionOrdinal'] is not None and start<=x['childMs']<=end]
    assert len(a)==12 and max(a)-min(a)>=4000
    assert any(x['attemptId']==key and x['action']=='continue' and start<=x['childMs']<=end for x in rows('heartbeat'))
    spans.append({'attemptId':key,'firstAckMs':min(a),'lastAckMs':max(a),'count':len(a)})
points=sorted([(x['childMs'],1) for x in enters.values()]+[(x['childMs'],-1) for x in ends.values()]); live=0;peak=0
for _,change in points:live+=change;peak=max(peak,live)
s=c['sampledOwnership']; eligible=[x for x in rows('attempt-snapshot') if x['queryStartedMs']>=s['startReceivedMs'] and x['queryEndedMs']<=s['conservativeEndMs']]
assert len(eligible)==s['validatedSamples']==30
spacing=max(x['queryStartedMs'] for x in eligible)-min(x['queryEndedMs'] for x in eligible)
assert spacing==s['conservativeSampleSeparationMs'] and spacing>=4000
for sample in eligible:
    assert len(sample['rows'])==128
    for x in sample['rows']:
        g=gate[x['attempt_id']]
        assert x['status']=='running' and x['live'] and x['completed_at'] is None
        assert all(x[k]==g[k] for k in ['task_id','current_attempt_id','attempt_id','runner_id','task_version','owner_version','native_session_id','session_id','session_runner_id','session_harness','session_task_id'])
http=rows('runner-http'); errors=rows('runner-http-error'); sends=rows('runner-request-send')
assert len(sends)==len(http)+len(errors)==3784 and len({x['requestOrdinal'] for x in sends})==3784
assert {x['requestOrdinal'] for x in sends}=={x['requestOrdinal'] for x in http+errors}
phases={}
for phase in sorted({x['phase'] for x in http+errors}):
    records=[x for x in http+errors if x['phase']==phase]
    phases[phase]={'requests':len(records),'statuses':counts(str(x.get('status')) for x in records),'errors':[x for x in records if x['kind']=='runner-http-error' or (x.get('status') or 0)>=400]}
stop=rows('stop-case-received')[0]['stoppedAtMs']
windowPhase='eight-by-sixteen:window'; w=[x for x in o if x['phase']==windowPhase]
metrics={}
for label,cond in [('poolAcquisition',lambda x:x['kind']=='pool-acquisition'),('transactionElapsed',lambda x:x['kind']=='transaction'),('runnerRowExclusiveElapsed',lambda x:x['kind']=='sql' and x.get('category')=='runner-row')]:
    metrics[label]=distribution([x['elapsedMs'] for x in w if cond(x) and x.get('poolRole')=='center'])
metrics['runnerRowShareElapsed']={'state':'UNKNOWN','classifiedCount':0,'reason':'Classifier expects SELECT *, but fixed P04 uses SELECT id,revoked FOR SHARE; real calls are in other. No row-specific duration can be recovered because SQL is intentionally not stored.'}
activity=[x for x in w if x['kind']=='pg-activity']; lockSamples=[x for x in activity if any(y.get('wait_event_type')=='Lock' or y.get('blockers') for y in x['activity'])]
metrics['pgActivity']={'windowSamples':len(activity),'lockOrBlockerPositiveSamples':len(lockSamples),'allRunSamples':len(rows('pg-activity')),'allRunLockOrBlockerPositiveSamples':sum(any(y.get('wait_event_type')=='Lock' or y.get('blockers') for y in x['activity']) for x in rows('pg-activity')),'interpretation':'Positive sampled evidence only; misses do not imply no lock waits.'}
mem={}
for role in ['driver','center','runner']:
    a=[x for x in rows('memory') if x['role']==role]
    mem[role]={'samples':len(a),'peakSampledRssBytes':max(x['rss'] for x in a),'peakSampledHeapUsedBytes':max(x['heapUsed'] for x in a),'maxReportedProcessMaxRssKiB':max(x['maxRssKiB'] for x in a)}
analysis={'mode':'offline_saved_json_only','runVerdict':'PASS','totals':r['databaseFinal']['totals'],'topology':{'runtimeInvocations':8,'capacityEach':16,'runnerOsProcesses':len({x['pid'] for x in enters.values()}),'centerOsProcesses':1,'driverOsProcesses':1,'runnerDistribution':sorted(collections.Counter(x['runner_id'] for x in gate.values()).values())},'events':{'persisted':2304,'uniqueIds':len(ackEvents),'perAttemptSequences':'1..18','acceptedTotal':sum(x['acknowledgement']['accepted'] for x in acks),'terminalSuccess':128},'activity':{'clock':'one runner-child monotonic clock','logicalAdapterPeak':peak,'allAdapterOverlapMs':min(x['childMs'] for x in ends.values())-max(x['childMs'] for x in enters.values()),'minAdapterEndAfterWindowStartMs':min(x['childMs'] for x in ends.values())-start,'windowTimerMarkerMs':rows('window-end')[0]['endedMs']-start,'all128CommonAckEnvelopeMs':min(x['lastAckMs'] for x in spans)-max(x['firstAckMs'] for x in spans),'perAttemptNetworkEventAckSpanMs':distribution([x['lastAckMs']-x['firstAckMs'] for x in spans]),'perAttemptEmitReturnSpanMs':distribution([x['lastAckMs']-x['firstAckMs'] for x in c['activity']['spans']]),'emitReturnCommonAckEnvelopeMs':c['activity']['commonAckSpanMs'],'lastCompletedAckAfterWindowMs':max(x['childMs'] for x in acks if any(e['type']=='completed' for e in x['events']))-end,'eachWindowMessageAcks':12,'windowMessageAckCount':sum(x['count'] for x in spans),'barrierWaitingMs':distribution([x['releasedAtMs']-x['waitingAtMs'] for x in rows('barrier-released')]),'notClaimed':'ACK envelope is not uninterrupted CPU, provider execution, token throughput or capacity SLO.'},'sampledOwnership':{'samples':len(eligible),'conservativeSampleSeparationMs':spacing,'queryBoundaryExcludedAtValidation':len(s['excludedBoundarySamples']),'finalArchiveIneligibleSamples':len(rows('attempt-snapshot'))-len(eligible),'postValidationAdditionalSamples':len(rows('attempt-snapshot'))-len(eligible)-len(s['excludedBoundarySamples']),'meaning':s['meaning']},'requests':{'runnerSendCount':len(sends),'runnerSettledCount':len(http)+len(errors),'runnerErrors':errors,'phasesByParentReceipt':phases,'sentAtOrAfterStop':sum(x['sentChildMs']>=stop for x in sends),'settledAfterStop':sum(x['settledChildMs']>=stop for x in http+errors),'heartbeatActions':counts(x['action'] for x in rows('heartbeat')),'ownerStatusCounts':counts(str(x.get('status')) for x in rows('owner-http')),'interpretation':'Request send/settle/stop use the runner child clock. Parent-receive phase is approximate. Zero recorded HTTP failures is observed here, not inferred from PASS.'},'windowCenterMetricsMs':metrics,'memory':mem,'observations':{'records':len(o),'bytes':(P/'observations.json').stat().st_size,'recordCounts':counts(x['kind'] for x in o),'instrumentationOverhead':'Observer, IPC, row decoding and serialization are included; no uninstrumented comparison.'},'background':{'loadStart':r['background']['loadStart'],'loadEnd':r['background']['loadEnd'],'otherTeamsPaused':False},'journals':{'count':8,'inFlightNull':8,'assignmentsEmpty':8},'cleanup':r['cleanup'],'byteAccountingComplete':r['byteAccountingComplete'],'finalMeasuredBytes':cli['finalMeasuredBytes'],'providerCalls':0,'unknowns':['Exact FOR SHARE row query duration unavailable due to classifier mismatch','Pool acquisition includes connection establishment; transaction/SQL elapsed includes execution and round trips','Observed lock samples do not measure pure lock-wait duration','Process imports precede the inner main clock; complete outer time is in cli-time.stderr']}
(P/'analysis.json').write_text(json.dumps(analysis,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:analysis[k] for k in ['totals','activity','sampledOwnership','windowCenterMetricsMs','memory']},ensure_ascii=False))
