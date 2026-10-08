import { useState } from "react";
import { Button } from "../components/ui/button";
import { connectionPresentation, submitConnection } from "./presentation";

export interface ConnectionProps {
  onConnect: (url: string, token: string) => void;
  address?: string;
  phase?: string;
  error?: string;
  onRead?: () => void;
  onLogout?: () => void;
  onDiscardRetained?: () => void;
}

export function Connection({ onConnect, address = "", phase, error, onRead, onLogout, onDiscardRetained }: ConnectionProps) {
  const [url, setUrl] = useState(address);
  const [token, setToken] = useState("");
  const view = connectionPresentation(phase, !!onRead);
  return (
    <main id="main" tabIndex={-1} className="flow-connect" data-extension-slot="settings.sections">
      <h1>Sign in to Flow</h1>
      <p role="status">{view.message}</p>
      <p>{view.nextStep}</p>
      {error && <p role="alert" className="break-words [overflow-wrap:anywhere]">{error}</p>}
      {onRead && <Button type="button" variant={view.primary === "check" ? "default" : "outline"}
        aria-disabled={view.pending} onClick={() => { if (!view.pending) onRead(); }}>Check existing browser session</Button>}
      {onLogout && <Button type="button" variant="outline" onClick={onLogout}>Sign out of this center</Button>}
      {onDiscardRetained && <Button type="button" variant="outline" onClick={onDiscardRetained}>Discard previous page-only work</Button>}
      <form onSubmit={event => {
        event.preventDefault();
        submitConnection({ ...(phase === undefined ? {} : { phase }), address: url, token }, { clearToken: () => setToken(""), connect: onConnect });
      }}>
        <label>
          Center URL
          <input type="url" value={url} placeholder="This installation" aria-describedby="center-url-help"
            onChange={event => setUrl(event.target.value)} />
        </label>
        <small id="center-url-help">Leave blank to use this installation, or enter the workspace address supplied by your administrator.</small>
        <label>
          Owner token
          <input type="password" autoComplete="off" required value={token} aria-describedby="connection-token-help"
            onChange={event => setToken(event.target.value)} />
        </label>
        <div id="connection-token-help" className="text-sm">
          <p>For a local personal installation, open that installation’s engineering dashboard and choose <strong>本机登录凭据</strong> (local sign-in credentials).</p>
          <p>For a remote workspace, ask its administrator for the workspace address and access token.</p>
        </div>
        <Button type="submit" variant={view.primary === "connect" ? "default" : "outline"} aria-disabled={view.pending}>Connect workspace</Button>
        <details className="text-sm">
          <summary>Connection details</summary>
          <p>The owner token is used only for your explicit connection and is cleared from this form when submitted. It is a Flow workspace token, not a Claude or Pi login token.</p>
          <p>A supported center uses an HttpOnly browser session. Saved drafts appear only after that center confirms your identity. Leaving the address blank uses this Web app’s configured /api proxy.</p>
          <p><a href="https://github.com/CM-BF/Flow/blob/6426b44cd32d10216141af13ecfa83b8879025fb/tools/personal-preview/README.md" target="_blank" rel="noreferrer">Personal preview setup</a> · <a href="https://github.com/CM-BF/Flow/blob/6426b44cd32d10216141af13ecfa83b8879025fb/apps/web/README.md" target="_blank" rel="noreferrer">Web connection setup</a></p>
        </details>
      </form>
    </main>
  );
}
