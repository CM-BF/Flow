"""Bounded read-only metadata qualification; no payload content scan or mutation."""
import base64, datetime, gzip, hashlib, importlib.util, json, os, re, stat, subprocess, time
from collections import Counter
from pathlib import Path
MAP=Path('/tmp/flow-workspace-cache-payload-map.json')
RAW_SHA='064104abd211285b77e8febfbde451e7cfcdb1c5fd3780cb2bdfce381ace8ab3'
started=time.monotonic(); deadline=started+25
assert os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize >= 1077936128, 'FRESH_RESOURCE_GATE'
raw=MAP.read_bytes(); assert hashlib.sha256(raw).hexdigest()==RAW_SHA
mapping=json.loads(raw); root=Path(mapping['candidateRoot']); store=Path(mapping['CASRoot'])
reader_path=Path('/tmp/flow-workspace-cache-sample-restore.py')
assert hashlib.sha256(reader_path.read_bytes()).hexdigest()=='23d46f6575388823f6e6f96a3c1430f27ce4c31a296aa4a509b5e7745086ffb0'
spec=importlib.util.spec_from_file_location('sample_readonly_xattr',reader_path)
reader=importlib.util.module_from_spec(spec); spec.loader.exec_module(reader)
cas_paths=[str(store/r[0]) for r in mapping['cas']]
target_paths=[str(root/mapping['packages'][r[0]]['targetPrefix']/r[1]) for r in mapping['files']]
acl={}; acl_batches=0; errors=[]
# One bounded system metadata reader per 256 literal paths, never per-file spawning.
for offset in range(0,len(cas_paths+target_paths),256):
 if time.monotonic()>deadline-6: break
 chunk=(cas_paths+target_paths)[offset:offset+256]
 if any(any(ord(c)<32 or ord(c)==127 for c in p) for p in chunk): continue
 try:
  r=subprocess.run(['/bin/ls','-lden',*chunk],stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                   timeout=min(2,deadline-time.monotonic()),env={'PATH':'/usr/bin:/bin','LC_ALL':'C'})
  acl_batches+=1
  if r.returncode or len(r.stdout)>1024*1024 or r.stderr: raise ValueError('ACL_READER_NOT_EXACT')
  observed={}; current=None
  for line in r.stdout.decode('utf8').splitlines():
   if line.startswith('-') and ' /' in line:
    name='/'+line.split(' /',1)[1]
    if name not in chunk or name in observed: raise ValueError('ACL_HEADER_UNKNOWN')
    current=name; observed[name]='present' if '+' in line.split()[0] else 'absent'
   elif re.match(r'^\s*\d+:',line) and current: observed[current]='present'
   else: raise ValueError('ACL_OUTPUT_UNKNOWN')
  if set(observed)!=set(chunk): raise ValueError('ACL_HEADER_INCOMPLETE')
  acl.update(observed)
 except Exception as error:
  if len(errors)<20: errors.append({'batchOffset':offset,'error':type(error).__name__})
profiles=[]; profile_ids={}
def metadata(path,expected):
 s=Path(path).lstat()
 assert stat.S_ISREG(s.st_mode) and [s.st_dev,s.st_ino,s.st_mtime_ns,s.st_size,stat.S_IMODE(s.st_mode)]==expected, 'IDENTITY_CHANGED'
 attrs=reader.attributes(path); key=json.dumps(attrs,sort_keys=True)
 if key not in profile_ids: profile_ids[key]=len(profiles); profiles.append(attrs)
 after=Path(path).lstat()
 assert (s.st_dev,s.st_ino,s.st_mtime_ns,s.st_size,s.st_mode,s.st_uid,s.st_gid,getattr(s,'st_flags',0),s.st_ctime_ns)==(after.st_dev,after.st_ino,after.st_mtime_ns,after.st_size,after.st_mode,after.st_uid,after.st_gid,getattr(after,'st_flags',0),after.st_ctime_ns), 'METADATA_CHANGED'
 return [s.st_uid,s.st_gid,getattr(s,'st_flags',0),profile_ids[key],acl.get(path,'unknown'),s.st_nlink]
cas_states=[]; target_states=[]; eligible=[]; keep={}
for path,row in zip(cas_paths,mapping['cas']):
 try: cas_states.append(metadata(path,row[2:7]) if time.monotonic()<deadline else None)
 except Exception: cas_states.append(None)
for fid,(path,row) in enumerate(zip(target_paths,mapping['files'])):
 reasons=[]; cs=cas_states[row[7]]
 try: ts=metadata(path,row[2:7]) if time.monotonic()<deadline else None
 except Exception: ts=None
 target_states.append(ts)
 if ts is None or cs is None: reasons.append('metadata-unknown-or-deadline')
 else:
  if ts[0]!=os.getuid() or cs[0]!=os.getuid(): reasons.append('not-current-owner')
  if ts[:4]!=cs[:4] or row[6]!=mapping['cas'][row[7]][6]: reasons.append('mode-owner-group-flags-xattr-mismatch')
  if ts[2]!=0 or cs[2]!=0: reasons.append('special-flags')
  if ts[4]!='absent' or cs[4]!='absent': reasons.append('acl-present-or-unknown')
  if ts[5]!=1: reasons.append('target-hardlink')
  if [a['name'] for a in profiles[ts[3]]]!=['com.apple.provenance']: reasons.append('attribute-outside-proven-sample')
 if reasons:
  for reason in reasons: keep.setdefault(reason,[]).append(fid)
 else: eligible.append(fid)
q={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceMapRawSha256':RAW_SHA,
 'metadataColumns':['uid','gid','flags','xattrProfileId','acl','nlink'],'xattrProfiles':profiles,
 'targetMetadata':target_states,'CASMetadata':cas_states,'eligibleFileIds':eligible,'keepByReason':keep,
 'ACL':{'reader':'/bin/ls -lden <at most 256 exact literal paths>','batches':acl_batches,'observed':len(acl),'states':dict(Counter(acl.values())),'errors':errors,'unknownRemainder':'KEEP'},
 'payloadHashesRerun':False,'actualExecutionRequiresFreshHashAndMetadata':True,
 'priorSampleReceiptSha256':'451d420d0ad0c4fee1fdb6f8cfe7d26846bb0e25352bfe65cbfee4e89d77782f',
 'ctimeNotRestored':True,'mtimeRestorationNotPromised':True,'inodeNotRestored':True,'eligibleIsNotRetirementPermission':True}
# Exact reversible normalization removes the duplicated SRI digest, not evidence.
compact=json.loads(raw); compact['casColumns'].pop(1)
for row in compact['cas']:
 sri=row.pop(1); hexadecimal=row[0].replace('/','').removesuffix('-exec')
 assert sri=='sha512-'+base64.b64encode(bytes.fromhex(hexadecimal)).decode()
restored=json.loads(json.dumps(compact)); restored['casColumns'].insert(1,'sha512SRI')
for row in restored['cas']: row.insert(1,'sha512-'+base64.b64encode(bytes.fromhex(row[0].replace('/','').removesuffix('-exec'))).decode())
assert (json.dumps(restored,separators=(',',':'))+'\n').encode()==raw
manager=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/ops-workspace-cache-dependency-consumers/manager-confirmation.json')
container={'schema':'flow-workspace-cache-qualified-payload-v1','payloadMapWithoutRedundantSRI':compact,
 'mapReconstruction':'Insert sha512SRI column at index 1; each CAS row index 1 = sha512- + base64(hexbytes(relativePath with slash removed and optional -exec suffix removed)); original JSON compact separators + LF.',
 'originalMapRawBytes':len(raw),'originalMapRawSha256':RAW_SHA,'qualification':q,
 'boundedConsumerConfirmation':{'path':str(manager),'bytes':manager.stat().st_size,'sha256':hashlib.sha256(manager.read_bytes()).hexdigest()},
 'operationState':'PREPARATION_ONLY_NO_RETIREMENT'}
result=(json.dumps(container,separators=(',',':'))+'\n').encode(); packed=gzip.compress(result,compresslevel=6,mtime=0)
assert len(packed)<3800000, 'NEW_BYTES_BUDGET'
out=Path('/tmp/flow-workspace-cache-qualified-payload.json.gz')
with out.open('xb') as f: f.write(packed)
summary={'at':q['at'],'source':str(Path(__file__)),'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'rawBytes':len(result),'rawSha256':hashlib.sha256(result).hexdigest(),'compressedPath':str(out),
 'compressedBytes':len(packed),'compressedSha256':hashlib.sha256(packed).hexdigest(),
 'roundTripQualifiedEqual':gzip.decompress(packed)==result,'roundTripOriginalMapEqual':True,'originalMapRawSha256':RAW_SHA,
 'qualifiedFiles':len(eligible),'qualifiedLogicalBytes':sum(mapping['files'][i][5] for i in eligible),
 'keepUniqueFiles':len(mapping['files'])-len(eligible),'keepReasonCounts':{k:len(v) for k,v in keep.items()},
 'xattrProfileCount':len(profiles),'ACL':q['ACL'],'elapsedMs':round((time.monotonic()-started)*1000),
 'noPayloadRehash':True,'noDependencyMutation':True,
 'priorAttempt':'Original direct gzip duplicated SRI; failed final size assertion before writing any manifest. No dependency changes.'}
with Path('/tmp/flow-workspace-cache-qualification-summary.json').open('x') as f: json.dump(summary,f,indent=2); f.write('\n')
print(json.dumps(summary,indent=2))
