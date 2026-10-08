/** Presentation policy only. The public session remains the authentication authority. */
export interface ConnectionPresentation {
  message: string;
  nextStep: string;
  primary: "connect" | "check" | "wait" | "contact";
  pending: boolean;
}

export function connectionPresentation(phase: string | undefined, hasSessionCheck: boolean): ConnectionPresentation {
  const check = hasSessionCheck ? "check" : "connect";
  switch (phase) {
    case "checking":
      return { message: "Checking this browser’s sign-in…", nextStep: "Please wait before trying again.", primary: "wait", pending: true };
    case "unauthenticated":
      return { message: "This browser is not signed in to this workspace.", nextStep: "Enter the workspace access token to sign in.", primary: "connect", pending: false };
    case "offline":
      return { message: "This workspace could not be reached.", nextStep: "Check your network, then check your sign-in again. Drafts and pending commands have not been cancelled.", primary: check, pending: false };
    case "forbidden":
      return { message: "This workspace denied the browser connection.", nextStep: "Ask the workspace administrator to check browser access and the workspace address.", primary: "contact", pending: false };
    case "unsupported":
      return { message: "This workspace does not support browser sign-in yet.", nextStep: "Ask its administrator to enable browser sessions, or provide a supported workspace address.", primary: "contact", pending: false };
    case "error":
      return { message: "The browser connection could not be checked.", nextStep: "Check the workspace address and try again. If this continues, contact its administrator.", primary: check, pending: false };
    case "ready":
      return { message: "This browser is signed in.", nextStep: "Check this connection to return to the workspace. Previous page-only work may still need your decision.", primary: check, pending: false };
    default:
      return { message: "Connect to your Flow workspace.", nextStep: hasSessionCheck ? "Check whether this browser is already signed in, or enter a workspace access token." : "Enter the workspace access token to connect.", primary: check, pending: false };
  }
}

/** Clear the transient credential before handing it to the existing explicit callback. */
export function submitConnection(
  input: { phase?: string; address: string; token: string },
  actions: { clearToken: () => void; connect: (address: string, token: string) => void },
): boolean {
  if (input.phase === "checking" || !input.token.trim()) return false;
  actions.clearToken();
  actions.connect(input.address, input.token);
  return true;
}
