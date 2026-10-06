"""One explicitly opened S01P07 PG test run; owns only its child group and temp root."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import signal
import stat
import subprocess
import tempfile
import time

def observe_group(pid, send=os.killpg):
    try:
        send(pid, 0)
        return {"state": "present", "errno": None}
    except ProcessLookupError:
        return {"state": "absent", "errno": None}
    except OSError as error:
        return {"state": "unknown", "errno": error.errno}


def signal_group(pid, action, send=os.killpg):
    try:
        send(pid, action)
        return {"state": "sent", "errno": None, "signal": action}
    except ProcessLookupError:
        return {"state": "absent", "errno": None, "signal": action}
    except OSError as error:
        return {"state": "unknown", "errno": error.errno, "signal": action}


def finish_process(process, observe=observe_group, send=signal_group):
    """One bounded owned-group cleanup. Unknown is never authority to escalate."""
    observations, signals = [], []
    code = process.poll()
    state = observe(process.pid); observations.append(state)
    if state["state"] == "present":
        sent = send(process.pid, signal.SIGTERM); signals.append(sent)
        if sent["state"] != "unknown":
            try: code = process.wait(timeout=.5)
            except subprocess.TimeoutExpired: code = None
            state = observe(process.pid); observations.append(state)
            if state["state"] == "present":
                sent = send(process.pid, signal.SIGKILL); signals.append(sent)
                if sent["state"] != "unknown":
                    try: code = process.wait(timeout=.5)
                    except subprocess.TimeoutExpired: code = None
                    state = observe(process.pid); observations.append(state)
    return {"exitCode": code, "observations": observations, "signals": signals,
            "groupState": state, "groupAbsent": state["state"] == "absent",
            "unknown": any(item["state"] == "unknown" for item in observations + signals)}


def read_owned_json(path, maximum):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
            raise ValueError("Invalid bounded receipt")
        value = os.read(descriptor, maximum + 1)
        if len(value) > maximum:
            raise ValueError("Receipt exceeds bound")
        return json.loads(value)
    finally:
        os.close(descriptor)


def main():
    WT = Path(__file__).resolve().parents[3]
    EVIDENCE = WT / "docs/evidence/s01p07"
    RAW_LIMIT = 1024 * 1024
    TEMP_LIMIT = 32 * 1024 * 1024
    started = time.monotonic()
    started_utc = datetime.datetime.now(datetime.timezone.utc)
    window = os.environ.get("FLOW_S01P07_PG_WINDOW", "")
    if os.environ.get("FLOW_S01P07_PG_OPEN") != "1" or not re.fullmatch(r"[A-Za-z0-9-]{1,80}", window):
        raise SystemExit("NOT_OPEN")
    if not os.environ.get("FLOW_S01P07_ADMIN_URL"):
        raise SystemExit("AUTHORIZED_ADMIN_CONFIGURATION_MISSING")
    target = EVIDENCE / "checks" / window
    suffixes = [".json", ".stdout", ".stderr", ".fixture.json", ".reservation.json", ".child.json"]
    suffixes += [".fixture.json" + part for part in [".reservation.json", ".root.json", ".create-request.json", ".database.json"]]
    for suffix in suffixes:
        try: Path(str(target) + suffix).lstat()
        except FileNotFoundError: continue
        raise SystemExit("EVIDENCE_EXISTS_NO_RETRY")
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=WT, text=True, timeout=3).strip()
    if head != os.environ.get("FLOW_S01P07_EXECUTION_HEAD"):
        raise SystemExit("SOURCE_HEAD_MISMATCH")
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=WT, timeout=3):
        raise SystemExit("SOURCE_DIRTY")
    for row in json.loads((EVIDENCE / "pg-slot-request.json").read_text())["inputs"]:
        value = (WT / row["path"]).read_bytes()
        if len(value) != row["bytes"] or hashlib.sha256(value).hexdigest() != row["sha256"]:
            raise SystemExit("FIXED_INPUT_MISMATCH")
    for row in json.loads((EVIDENCE / "pg-dynamic-inputs.json").read_text())["sql"]:
        value = (WT / row["path"]).read_bytes()
        if len(value) != row["bytes"] or hashlib.sha256(value).hexdigest() != row["sha256"]:
            raise SystemExit("SQL_INPUT_MISMATCH")
    for row in json.loads((EVIDENCE / "pg-dependency-inputs.json").read_text())["links"]:
        link = WT / row["path"]
        if str(link.resolve()) != row["target"] or hashlib.sha256((link / "package.json").read_bytes()).hexdigest() != row["sha256"]:
            raise SystemExit("DEPENDENCY_MISMATCH")
    previous = json.loads((EVIDENCE / "claim-amend.json").read_text())["claim"]
    ledger = json.loads(subprocess.check_output(["/opt/homebrew/opt/node@24/bin/node",
        "/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs", "list"],
        cwd=WT, timeout=3, stderr=subprocess.DEVNULL))
    current = next(row for row in ledger["claims"] if row["claimId"] == previous["claimId"])
    if ledger["state"] != "available" or any(current[key] != previous[key] for key in
        ["claimId", "version", "state", "role", "taskId", "lead", "worker", "worktree", "branch", "scope"]):
        raise SystemExit("CLAIM_NOT_CONFIRMED")
    free = os.statvfs(WT).f_bavail * os.statvfs(WT).f_frsize


    def save(path, value):
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            json.dump(value, stream, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())


    record = {"window": window, "sourceHead": head, "startedAt": started_utc.isoformat(),
              "resourceBefore": free, "resourceGate": 1207959552, "providerCalls": 0}
    if free < 1207959552:
        record.update({"state": "NOT_RUN_RESOURCE", "childStarted": False})
        save(str(target) + ".json", record)
        print(json.dumps(record))
        raise SystemExit(1)
    root = None
    try:
        root = Path(tempfile.mkdtemp(prefix="flow-s01p07-pg-window-"))
        record["root"] = str(root)
        identity = root.lstat()
        record["identity"] = {"dev": identity.st_dev, "ino": identity.st_ino}
        save(str(target) + ".reservation.json", record)
    except Exception as error:
        record.update({"state": "RESERVATION_UNKNOWN", "childStarted": False,
                       "retainedRoot": str(root) if root else None, "errno": getattr(error, "errno", None)})
        try: save(str(target) + ".json", record)
        except OSError: record["finalReceiptWrite"] = "UNKNOWN"
        print(json.dumps(record), flush=True)
        raise SystemExit(1)
    fixture_path = str(target) + ".fixture.json"
    env = os.environ.copy()
    epoch = int(started_utc.timestamp() * 1000)
    env.update({"TMPDIR": str(root), "FLOW_S01P07_CACHE": str(root / "vite"),
                "NODE_DISABLE_COMPILE_CACHE": "1", "TSX_DISABLE_CACHE": "1",
                "FLOW_S01P07_PG_RECEIPT": fixture_path,
                "FLOW_S01P07_PG_WORK_UNTIL": str(epoch + 120000),
                "FLOW_S01P07_PG_CLEANUP_UNTIL": str(epoch + 190000)})
    command = ["/opt/homebrew/opt/node@24/bin/node", "node_modules/vitest/vitest.mjs", "run",
               "--config", "docs/evidence/s01p07/pg-vitest.config.ts", "--configLoader", "native",
               "apps/server/src/runner-claim-receipts.test.ts"]
    faults = []
    observed = 0
    saved = 0
    peak = 0
    child = None
    selector = selectors.DefaultSelector()
    streams = {}


    def sample():
        current = root.lstat()
        if not current.st_dev == identity.st_dev or not current.st_ino == identity.st_ino or root.is_symlink():
            raise RuntimeError("ROOT_IDENTITY_UNKNOWN")
        pending, count, size = [root], 0, 0
        while pending:
            with os.scandir(pending.pop()) as entries:
                for entry in entries:
                    count += 1
                    if count > 4096 or entry.is_symlink():
                        raise RuntimeError("TEMP_INVENTORY_UNKNOWN")
                    if entry.is_dir(follow_symlinks=False):
                        pending.append(Path(entry.path))
                    elif entry.is_file(follow_symlinks=False):
                        size += entry.stat(follow_symlinks=False).st_size
                    else:
                        raise RuntimeError("TEMP_NODE_UNKNOWN")
        return size


    try:
        if time.monotonic() - started > 10:
            raise RuntimeError("PREPARATION_TIMEOUT")
        for channel in ("stdout", "stderr"):
            streams[channel] = os.fdopen(os.open(str(target) + "." + channel,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), "wb")
        child = subprocess.Popen(command, cwd=WT, env=env, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, start_new_session=True)
        save(str(target) + ".child.json", {"pid": child.pid, "pgid": child.pid, "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "window": window, "sourceHead": head})
        for channel in ("stdout", "stderr"):
            pipe = getattr(child, channel)
            os.set_blocking(pipe.fileno(), False)
            selector.register(pipe, selectors.EVENT_READ, channel)
        while child.poll() is None or selector.get_map():
            elapsed = time.monotonic() - started
            try:
                peak = max(peak, sample())
                if peak > TEMP_LIMIT and "TEMP_LIMIT" not in faults:
                    faults.append("TEMP_LIMIT")
            except (OSError, RuntimeError):
                faults.append("TEMP_INVENTORY_UNKNOWN")
            if elapsed >= 190:
                faults.append("EXECUTION_DEADLINE")
            if faults:
                break
            for key, _ in selector.select(.05):
                chunk = os.read(key.fileobj.fileno(), 16384)
                if not chunk:
                    selector.unregister(key.fileobj)
                    key.fileobj.close()
                    continue
                observed += len(chunk)
                retained = chunk[:max(0, RAW_LIMIT - saved)]
                streams[key.data].write(retained)
                saved += len(retained)
                if observed > RAW_LIMIT and "RAW_LIMIT" not in faults:
                    faults.append("RAW_LIMIT")
    except BaseException as error:
        faults.append(type(error).__name__)
    finally:
        process_facts = None
        if child is not None:
            try:
                process_facts = finish_process(child)
                if process_facts["unknown"] or not process_facts["groupAbsent"] or process_facts["exitCode"] is None:
                    faults.append("PROCESS_LIFECYCLE_UNKNOWN")
            except Exception as error:
                faults.append("PROCESS_CLEANUP_UNKNOWN")
                process_facts = {"exitCode": child.poll(), "groupAbsent": False,
                                 "secondaryType": type(error).__name__, "errno": getattr(error, "errno", None)}
            # Observe the tail once after bounded cleanup; no further signals or escalation.
            drain_until = min(started + 195, time.monotonic() + 2)
            try:
                while selector.get_map() and time.monotonic() < drain_until:
                    for key, _ in selector.select(.05):
                        chunk = os.read(key.fileobj.fileno(), 16384)
                        if not chunk:
                            selector.unregister(key.fileobj); key.fileobj.close(); continue
                        observed += len(chunk)
                        retained = chunk[:max(0, RAW_LIMIT - saved)]
                        streams[key.data].write(retained); saved += len(retained)
                if observed > RAW_LIMIT and "RAW_LIMIT" not in faults:
                    faults.append("RAW_LIMIT")
            except Exception as error:
                faults.append("STDIO_DRAIN_" + type(error).__name__)
        stdio_ended = not selector.get_map()
        if not stdio_ended: faults.append("STDIO_EOF_UNKNOWN")
        for key in list(selector.get_map().values()):
            try: key.fileobj.close()
            except OSError as error: faults.append("PIPE_CLOSE_" + str(error.errno))
        try: selector.close()
        except OSError as error: faults.append("SELECTOR_CLOSE_" + str(error.errno))
        for stream in streams.values():
            try: stream.close()
            except OSError as error: faults.append("RAW_CLOSE_" + str(error.errno))
    group_gone = child is None or bool(process_facts and process_facts["groupAbsent"])
    final_size = None
    try: final_size = sample(); peak = max(peak, final_size)
    except (OSError, RuntimeError): faults.append("FINAL_INVENTORY_UNKNOWN")
    if peak > TEMP_LIMIT and "TEMP_LIMIT" not in faults: faults.append("TEMP_LIMIT")
    fixture = None
    try:
        fixture = read_owned_json(fixture_path, 32768)
        if not isinstance(fixture, dict) or not isinstance(fixture.get("cleanup"), dict) or not isinstance(fixture.get("errors"), list):
            raise ValueError("Invalid fixture receipt")
    except (OSError, ValueError, RuntimeError):
        fixture = None
        faults.append("FIXTURE_RECEIPT_UNKNOWN")
    complete = bool(fixture and fixture.get("window") == window and fixture.get("sourceHead") == head
        and not fixture.get("errors", ["UNKNOWN"]) and all(fixture.get("cleanup", {}).get(key) is True
        for key in ["startupSettled", "appClosed", "poolClosed", "adminClosed", "databaseAbsent", "rootAbsent"]))
    if complete and group_gone and stdio_ended and final_size is not None and not faults:
        try:
            current = root.lstat()
            if (current.st_dev, current.st_ino) != (identity.st_dev, identity.st_ino):
                raise RuntimeError("ROOT_IDENTITY_CHANGED")
            shutil.rmtree(root)
        except (OSError, RuntimeError) as error:
            faults.append("ROOT_CLEANUP_" + type(error).__name__)
    absent = False
    try: root.lstat()
    except FileNotFoundError: absent = True
    except OSError: faults.append("ROOT_ABSENCE_UNKNOWN")
    record.update({"command": command, "childStarted": child is not None,
        "exitCode": child.returncode if child else None, "primaryFault": faults[0] if faults else None, "faults": faults, "processGroupGone": group_gone,
        "stdioEnded": stdio_ended, "process": process_facts, "fixtureCleanupConfirmed": complete, "temporaryFinalBytes": final_size,
        "temporarySampledPeakBytes": peak, "temporaryAbsent": absent, "retainedRoot": None if absent else str(root),
        "rawObservedBytes": observed, "rawSavedBytes": saved, "elapsedSeconds": time.monotonic() - started,
        "finishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "limits": {"totalSeconds": 200,
        "workSeconds": 120, "rawBytes": RAW_LIMIT, "ownTempBytes": TEMP_LIMIT},
        "boundary": "Sampled own logical temp bytes; shared PG/WAL growth and between-sample peak are unknown."})
    try: save(str(target) + ".json", record)
    except OSError as error:
        faults.append("FINAL_RECEIPT_WRITE_UNKNOWN")
        record["finalReceiptErrno"] = error.errno
    print(json.dumps(record), flush=True)
    raise SystemExit(0 if child and child.returncode == 0 and complete and not faults and absent
                     and time.monotonic() - started < 200 else 1)


if __name__ == "__main__":
    main()
