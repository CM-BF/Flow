import { z } from 'zod';

export const BROWSER_SESSION_PROTOCOL = 'flow.browser-session.v1' as const;
export const BROWSER_SESSION_CSRF_HEADER = 'X-Flow-CSRF';
export const BROWSER_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const BROWSER_SESSION_MAX_ACTIVE = 32;
const protocol = z.literal(BROWSER_SESSION_PROTOCOL);
/** Stable random center/principal identity; neither identifier is derived from an owner credential. */
export const browserSessionReadySchema = z.strictObject({ protocol, state: z.literal('ready'), centerId: z.uuid(),
  ownerPrincipalId: z.uuid(), expiresAt: z.iso.datetime(), csrfToken: z.string().regex(/^[a-f0-9]{64}$/) });
export const browserSessionReadSchema = z.discriminatedUnion('state', [browserSessionReadySchema,
  z.strictObject({ protocol, state: z.literal('unauthenticated') }), z.strictObject({ protocol, state: z.literal('unsupported') })]);
export const browserSessionCommandSchema = z.strictObject({});
export type BrowserSessionReady = z.infer<typeof browserSessionReadySchema>;
export type BrowserSessionRead = z.infer<typeof browserSessionReadSchema>;
