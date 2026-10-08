import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Connection } from "../src/connection/Connection";
import { applyTheme } from "../src/themes";
import "../src/assistant-ui.css";
import "../src/styles.css";

/** Synthetic prop/callback controls outside the real component; no session or credential store. */
function Fixture() {
  const [phase, setPhase] = useState<string | undefined>("idle");
  const [optional, setOptional] = useState(true);
  const [pending, setPending] = useState(false);
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => { release.current?.(); }, []);
  const [counts, setCounts] = useState({ read: 0, connect: 0, logout: 0, discard: 0, argumentsMatched: false });
  const increment = (key: "read" | "logout" | "discard") => setCounts(previous => ({ ...previous, [key]: previous[key] + 1 }));
  return <>
    <Connection {...(phase === undefined ? {} : { phase })} address="https://fixture.invalid"
      {...(phase === "error" ? { error: "Synthetic connection check failed. Your work remains available." } : {})}
      {...(optional ? { onRead: () => increment("read"), onLogout: () => increment("logout"), onDiscardRetained: () => increment("discard") } : {})}
      onConnect={(address, token) => {
        setCounts(previous => ({ ...previous, connect: previous.connect + 1,
          argumentsMatched: address === "https://fixture.invalid" && token === "synthetic-A" }));
        setPending(true); setPhase("checking");
        return new Promise<void>(resolve => { release.current = resolve; });
      }} />
    <aside aria-label="Synthetic fixture controls" style={{ padding: 16 }}>
      <p>Production Connection with synthetic props and callbacks. No authentication request is made.</p>
      <label htmlFor="fixture-phase">Fixture phase</label><select id="fixture-phase" value={phase ?? "undefined"} onChange={event => setPhase(event.target.value === "undefined" ? undefined : event.target.value)}>
        {["idle", "unauthenticated", "offline", "forbidden", "unsupported", "error", "ready", "checking", "undefined"].map(value => <option key={value}>{value}</option>)}
      </select>
      <label><input type="checkbox" checked={optional} onChange={event => setOptional(event.target.checked)} />Optional actions</label>
      <button type="button" onClick={() => { release.current?.(); release.current = null; setPending(false); setPhase("unauthenticated"); }}>Settle synthetic connection</button>
      <button type="button" onClick={() => applyTheme("light")}>Fixture light theme</button>
      <button type="button" onClick={() => applyTheme("dark")}>Fixture dark theme</button>
      <output data-testid="fixture-observation" style={{ display: "block", overflowWrap: "anywhere" }}>{JSON.stringify({ ...counts, pending })}</output>
    </aside>
  </>;
}
applyTheme("light");
const root = document.getElementById("root");
if (!root) throw new Error("Fixture mount missing");
createRoot(root).render(<Fixture />);
