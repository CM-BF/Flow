"""Bounded local checks; the established OPS14 module owns supervision."""
import dataclasses, datetime, hashlib, importlib.util, json, os, shutil, stat, sys, tempfile
from pathlib import Path
EVIDENCE = Path(__file__).resolve().parent
ROOT = EVIDENCE / "inputs"
OPS = Path("/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py")
assert hashlib.sha256(OPS.read_bytes()).hexdigest() == "725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d"
spec = importlib.util.spec_from_file_location("center_ops14", OPS)
shared = importlib.util.module_from_spec(spec); sys.modules[spec.name] = shared; spec.loader.exec_module(shared)
label = sys.argv[1]; assert label in ("types", "behavior", "types-fixed", "behavior-fixed", "behavior-final")
record_file = EVIDENCE / "local.json"
record = json.loads(record_file.read_text()) if record_file.exists() else {"runs": []}
assert len(record["runs"]) < 4 and all(r["resourceClosed"] for r in record["runs"])
assert all(r["label"] != label for r in record["runs"])
now = datetime.datetime.now(datetime.timezone.utc)
assert now < datetime.datetime(2026, 10, 7, 22, 28, 20, tzinfo=datetime.timezone.utc)
canonical = Path("/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/resource-window-current.json")
budget = json.loads(canonical.read_bytes()); forward = budget["forwardAdmission"]
terms = forward["termsBytes"]; assert all(type(v) is int and v >= 0 for v in terms.values())
floor = forward["minimumFreshFreeBytes"]; assert sum(terms.values()) == floor
free = shutil.disk_usage(ROOT).free; assert free >= floor
inputs = json.loads((EVIDENCE / "fixed-inputs.json").read_text())
for row in inputs["rows"]:
    content = (ROOT / row["path"]).read_bytes()
    assert len(content) == row["bytes"] and hashlib.sha256(content).hexdigest() == row["sha256"]
node = "/opt/homebrew/opt/node@24/bin/node"
argv = [node, str(ROOT / "node_modules/typescript/bin/tsc"), "--noEmit", "--project", str(EVIDENCE / "types.tsconfig.json")]
if label.startswith("behavior"):
    argv = [node, str(ROOT / "node_modules/vitest/vitest.mjs"), "run", "--config", str(EVIDENCE / "vitest.config.ts"), "--configLoader", "runner", "--no-cache"]
if label == "behavior-final": argv += ["-t", "^factory keeps verifier routes disabled by default and rejects a partial explicit policy$"]
scratch = Path(tempfile.mkdtemp(prefix="flow-center-wiring-", dir="/private/tmp")); identity = scratch.lstat()
reservation = {"at": now.isoformat(), "label": label, "argv": argv, "floor": floor, "free": free, "canonicalAt": budget["recordedAt"], "terms": terms,
               "scratch": {"path": str(scratch), "dev": identity.st_dev, "ino": identity.st_ino},
               "inputManifestSha256": hashlib.sha256((EVIDENCE / "fixed-inputs.json").read_bytes()).hexdigest(),
               "ownedSource": json.loads((EVIDENCE / "owned-source.json").read_text())}
(EVIDENCE / (label + "-reservation.json")).write_text(json.dumps(reservation, indent=2) + "\n")
env = {"PATH": "/opt/homebrew/opt/node@24/bin:/usr/bin:/bin", "HOME": str(scratch), "TMPDIR": str(scratch), "XDG_CACHE_HOME": str(scratch), "CI": "1", "NO_COLOR": "1", "NODE_DISABLE_COMPILE_CACHE": "1", "TSX_DISABLE_CACHE": "1"}
used_ms = sum(r["elapsed_ms"] for r in record["runs"])
assert used_ms < 54000
work_seconds = min(24, (60000 - used_ms) / 1000 - 6)
raw_file = EVIDENCE / (label + ".log")
assert not raw_file.exists()
report = shared.supervise(shared.Launch(tuple(argv), str(ROOT), env, shared.Ownership.NEW_CHILD_SESSION, shared.Capture.MERGED), shared.Policy(work_seconds, 2, 4, 32768))
raw_file.write_bytes(report.stdout)
facts = dataclasses.asdict(report); facts.pop("stdout"); facts.pop("stderr")
closed = report.exit_code is not None and report.owned_state == "absent" and report.capture == "merged" and report.eof == {"stdout": True} and report.observed_bytes == report.retained_bytes == len(report.stdout) and not report.secondary_failures and not report.signals and (report.first_failure is None or report.first_failure["code"] == "CHILD_EXIT_NONZERO")
cleanup = "KEEP"
cleanup_error = None
try:
    if closed:
        current = scratch.lstat()
        if stat.S_ISDIR(current.st_mode) and not stat.S_ISLNK(current.st_mode) and (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino):
            with os.scandir(scratch) as children: empty = next(children, None) is None
            if empty:
                scratch.rmdir()
                try: scratch.lstat()
                except FileNotFoundError: cleanup = "EXACT_ENOENT"
except OSError as error:
    cleanup_error = {"type": type(error).__name__, "errno": error.errno}

facts.update(label=label, resourceClosed=closed, scratchCleanup=cleanup, cleanupError=cleanup_error, rawSha256=hashlib.sha256(report.stdout).hexdigest(), endedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
record["runs"].append(facts); record_file.write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps({"label": label, "exit": report.exit_code, "closed": closed, "scratch": cleanup, "pid": report.pid}), flush=True)
sys.exit(0 if closed and cleanup == "EXACT_ENOENT" and report.exit_code == 0 else 1)
