import { z } from 'zod';

export const protocolTaskSchema = z.strictObject({ endpointRef: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/) });
export type ProtocolTask = z.infer<typeof protocolTaskSchema>;
