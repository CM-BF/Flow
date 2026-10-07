import ast,json,os,pathlib,stat,sys,time
parent=pathlib.Path(sys.argv[1]);base=pathlib.Path(sys.argv[2])
source=parent.read_text();tree=ast.parse(source);compile(tree,str(parent),'exec')
names={'owned_identity','close_owned_chain','open_owned_chain','verify_owned_chain','create_owned_scratch','remove_owned_scratch'}
functions=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in names]
assert len(functions)==len(names)
space={'os':os,'pathlib':pathlib,'stat':stat,'time':time};exec(compile(ast.Module(body=functions,type_ignores=[]),str(parent),'exec'),space)
create=space['create_owned_scratch'];remove=space['remove_owned_scratch'];close=space['close_owned_chain'];results=[]
def refused(operation):
 try:operation()
 except (RuntimeError,OSError):return
 raise AssertionError('unsafe delete was not refused')
def run(name,test):
 test();results.append({'name':name,'outcome':'PASS'})
def sample(name):
 case=base/name;case.mkdir();packet=case/'packet';packet.mkdir();owned=create(packet);(packet/'scratch'/'keep.txt').write_text('owned')
 return case,packet,owned
def normal():
 case,packet,owner=sample('normal');outside=case/'outside';outside.mkdir();(outside/'foreign.txt').write_text('foreign');(packet/'scratch'/'link').symlink_to(outside,target_is_directory=True);nested=packet/'scratch'/'chrome';nested.mkdir();(nested/'profile').write_text('profile')
 try:remove(owner,time.monotonic()+5);assert not (packet/'scratch').exists();assert (outside/'foreign.txt').read_text()=='foreign'
 finally:close(owner)
 outside.joinpath('foreign.txt').unlink();outside.rmdir();packet.rmdir();case.rmdir()
def replaced_root():
 case,packet,owner=sample('replaced-root');original=packet/'original';(packet/'scratch').rename(original);(packet/'scratch').mkdir();(packet/'scratch'/'foreign.txt').write_text('foreign')
 try:
  refused(lambda:remove(owner,time.monotonic()+5));assert (original/'keep.txt').read_text()=='owned';assert (packet/'scratch'/'foreign.txt').read_text()=='foreign'
  (packet/'scratch'/'foreign.txt').unlink();(packet/'scratch').rmdir();original.rename(packet/'scratch');remove(owner,time.monotonic()+5)
 finally:close(owner)
 packet.rmdir();case.rmdir()
def replaced_ancestor():
 case,packet,owner=sample('replaced-ancestor');moved=case/'moved';packet.rename(moved);foreign=case/'foreign';foreign.mkdir();(foreign/'scratch').mkdir();(foreign/'scratch'/'foreign.txt').write_text('foreign');packet.symlink_to(foreign,target_is_directory=True)
 try:
  refused(lambda:remove(owner,time.monotonic()+5));assert (moved/'scratch'/'keep.txt').read_text()=='owned';assert (foreign/'scratch'/'foreign.txt').read_text()=='foreign'
  packet.unlink();moved.rename(packet);remove(owner,time.monotonic()+5)
 finally:close(owner)
 (foreign/'scratch'/'foreign.txt').unlink();(foreign/'scratch').rmdir();foreign.rmdir();packet.rmdir();case.rmdir()
def symlink_root():
 case,packet,owner=sample('symlink-root');original=packet/'original';(packet/'scratch').rename(original);(packet/'scratch').symlink_to(original,target_is_directory=True)
 try:
  refused(lambda:remove(owner,time.monotonic()+5));assert (original/'keep.txt').read_text()=='owned';(packet/'scratch').unlink();original.rename(packet/'scratch');remove(owner,time.monotonic()+5)
 finally:close(owner)
 packet.rmdir();case.rmdir()
def changed_after_enumeration():
 case,packet,owner=sample('changed-after-enumeration');moved=case/'moved';foreign=case/'foreign';foreign.mkdir();(foreign/'scratch').mkdir();(foreign/'scratch'/'foreign.txt').write_text('foreign');real_scan=os.scandir;swapped=False
 def scan(fd):
  nonlocal swapped
  iterator=real_scan(fd)
  if not swapped:swapped=True;packet.rename(moved);packet.symlink_to(foreign,target_is_directory=True)
  return iterator
 try:
  os.scandir=scan
  try:refused(lambda:remove(owner,time.monotonic()+5))
  finally:os.scandir=real_scan
  assert swapped;assert (moved/'scratch'/'keep.txt').read_text()=='owned';assert (foreign/'scratch'/'foreign.txt').read_text()=='foreign'
  packet.unlink();moved.rename(packet);remove(owner,time.monotonic()+5)
 finally:close(owner)
 (foreign/'scratch'/'foreign.txt').unlink();(foreign/'scratch').rmdir();foreign.rmdir();packet.rmdir();case.rmdir()
def expired():
 case,packet,owner=sample('expired')
 try:
  refused(lambda:remove(owner,time.monotonic()-1));assert (packet/'scratch'/'keep.txt').read_text()=='owned';remove(owner,time.monotonic()+5)
 finally:close(owner)
 packet.rmdir();case.rmdir()
def name_reappears():
 case,packet,owner=sample('reappears');real_remove=os.rmdir;reappeared=False
 def rmdir(name,*,dir_fd=None):
  nonlocal reappeared
  real_remove(name,dir_fd=dir_fd)
  if name=='scratch' and dir_fd==owner[-2]['fd']:
   os.mkdir(name,dir_fd=dir_fd);reappeared=True
 try:
  os.rmdir=rmdir
  try:refused(lambda:remove(owner,time.monotonic()+5))
  finally:os.rmdir=real_remove
  assert reappeared and (packet/'scratch').is_dir();assert list((packet/'scratch').iterdir())==[];real_remove(packet/'scratch')
 finally:close(owner)
 packet.rmdir();case.rmdir()
for name,test in [('normal and nofollow child symlink',normal),('replaced scratch identity KEEP',replaced_root),('ancestor rename plus symlink KEEP',replaced_ancestor),('scratch symlink KEEP',symlink_root),('ancestor swapped during enumeration KEEP before child unlink',changed_after_enumeration),('deadline KEEP',expired),('reappearing name reports absence UNKNOWN',name_reappears)]:run(name,test)
assert list(base.iterdir())==[]
print(json.dumps({'state':'PASSED','checks':results,'testedActualParentFunctions':sorted(names),'samplesRemoved':True,'network':False,'PG':False,'HTTP':False,'Chrome':False}),flush=True)
