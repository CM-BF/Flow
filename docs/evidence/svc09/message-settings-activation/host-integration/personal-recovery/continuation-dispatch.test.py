"""One actual pending JSON and inherited-pins dispatch, with only final execute replaced."""
import importlib.util, json, time
from pathlib import Path
from types import SimpleNamespace
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('remaining_actual_dispatch', HERE / 'run.py')
caller = importlib.util.module_from_spec(spec); spec.loader.exec_module(caller)
dispatch = json.loads((HERE / 'continuation-dispatch.json').read_bytes())
original_pin = caller.pin
read_pins = []
def checked_pin(binding):
    data = original_pin(binding); read_pins.append(binding['path'])
    if binding['path'] == dispatch['input']['path']:
        value = json.loads(data); assert value['ready'] is False
        value['ready'] = True; value['migration']['budget']['freshBytes'] = 17452105728
        return json.dumps(value).encode()
    return data
caller.pin = checked_pin
captured = []
def execute(window, deadline, **options):
    captured.append((window, options['plan']))
    assert options['verify']() == {'supervisor': dispatch['supervisor']}
    assert options['validate']() is None
caller.load = lambda path, name: SimpleNamespace(execute=execute) if path == dispatch['continuation']['path'] else (_ for _ in ()).throw(AssertionError('UNEXPECTED_LOAD'))
assert caller.main(['--execute-remaining-once', str(int(time.time()*1000)+5000), str(time.monotonic()+5)]) == 0
assert len(captured) == 1
window, plan = captured[0]
assert window == 'svc06-personal-held23-e15-continuation-once'
assert [item['name'] for item in plan['steps']] == ['fresh', 'rebind', 'refresh', 'checkpoint', 'resume', 'final']
inherited = json.loads(original_pin(dispatch['inheritedDispatch']))
expected = {item['path'] for item in inherited['bindings']} | {item['path'] for item in dispatch['bindings']}
assert expected.issubset(read_pins)
assert all(item['ownership'] == 'childPidOnly' for item in plan['steps'])
assert all(item['maximumWorkSeconds'] <= 180 for item in plan['steps'])
print(json.dumps({'selected':1,'passed':1,'effectivePins':len(expected),'personalIO':0,'PG':0,'services':0,'actualExecution':'REPLACED_ONLY_FINAL_CONTINUATION_EXECUTE'}))
