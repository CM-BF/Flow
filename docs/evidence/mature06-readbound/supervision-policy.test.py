"""Exercise only the caller predicate AST: no supervisor import, process, signal or TMP."""
import ast
from pathlib import Path
from types import SimpleNamespace
source=Path(__file__).with_name('run-local.py').read_text()
function=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='process_closed')
namespace={};exec(compile(ast.Module(body=[function],type_ignores=[]),'caller-predicate','exec'),namespace)
closed=namespace['process_closed']
base=dict(exit_code=0,owned_state='absent',eof={'stdout':True},observed_bytes=1,retained_bytes=1,stdout=b'x',secondary_failures=[],first_failure=None,signals=[],observations=[{'state':'unknown','errno':1},{'state':'absent'}])
cases=[({},True),({'exit_code':1,'first_failure':{'code':'CHILD_EXIT_NONZERO'}},True),
 ({'owned_state':'unknown'},False),({'owned_state':'present'},False),({'exit_code':None},False),({'eof':{}},False),
 ({'eof':{'stdout':False}},False),({'signals':[{'state':'unknown'}]},False),({'first_failure':{'code':'STOP_UNKNOWN'}},False),
 ({'secondary_failures':[{'code':'READ_FAILED'}]},False),({'observed_bytes':2},False),({'stdout':b''},False)]
for delta,expected in cases:assert closed(SimpleNamespace(**(base|delta))) is expected,delta
print(f'{len(cases)} selected / {len(cases)} passed; pure predicate only')
