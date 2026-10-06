import { z } from 'zod';
const text = z.string().min(1).max(16_000).refine(value => value.trim().length > 0 && Buffer.byteLength(value, 'utf8') <= 64 * 1024);
const cursor = z.string().min(1).max(128).optional();
export const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('help') }),
  z.strictObject({ type: z.literal('conversations'), after: cursor }),
  z.strictObject({ type: z.literal('open'), id: z.uuid() }),
  z.strictObject({ type: z.literal('profiles'), after: cursor }),
  z.strictObject({ type: z.literal('new'), title: z.string().trim().min(1).max(180).default('Terminal conversation'), profileId: z.uuid().optional() }),
  z.strictObject({ type: z.literal('send'), text }),
  z.strictObject({ type: z.literal('recover') }),
  z.strictObject({ type: z.literal('disconnect') }),
  z.strictObject({ type: z.literal('quit') }),
]);
export type Command = z.infer<typeof commandSchema>;
export interface CommandDescriptor { name: Command['type']; usage: string; description: string; parse: (argument: string) => unknown }
const noArguments = (type: Command['type']) => (argument: string) => {
  if (argument.trim()) throw new Error('Unexpected arguments');
  return { type };
};
export const commandDescriptors: readonly CommandDescriptor[] = [
  { name: 'help', usage: '/help', description: 'List available commands.', parse: noArguments('help') },
  { name: 'conversations', usage: '/conversations [cursor]', description: 'List one page of saved conversations.', parse: after => ({ type: 'conversations', ...(after.trim() ? { after: after.trim() } : {}) }) },
  { name: 'open', usage: '/open <id>', description: 'Observe a saved conversation.', parse: id => ({ type: 'open', id: id.trim() }) },
  { name: 'profiles', usage: '/profiles [cursor]', description: 'List configured execution profiles; availability remains unprobed.', parse: after => ({ type: 'profiles', ...(after.trim() ? { after: after.trim() } : {}) }) },
  { name: 'new', usage: '/new [--profile <id>] [title]', description: 'Create a conversation; does not itself start a model.', parse: argument => {
    const match = /^--profile\s+(\S+)(?:\s+([\s\S]*))?$/.exec(argument.trim());
    return { type: 'new', title: (match ? match[2] : argument)?.trim() || 'Terminal conversation', ...(match ? { profileId: match[1] } : {}) };
  } },
  { name: 'send', usage: '/send <text>', description: 'Submit a follow-up; configured execution may call a model.', parse: value => ({ type: 'send', text: value }) },
  { name: 'recover', usage: '/recover', description: 'Explicitly replay one unresolved original request, or reload current history.', parse: noArguments('recover') },
  { name: 'disconnect', usage: '/disconnect', description: 'Stop observing. Center tasks keep running.', parse: noArguments('disconnect') },
  { name: 'quit', usage: '/quit', description: 'Exit without cancelling center work.', parse: noArguments('quit') },
];
export function parseInput(value: string): Command {
  if (!value.startsWith('/')) return commandSchema.parse({ type: 'send', text: value });
  const match = /^\/(\S+)(?:[ \t]([\s\S]*))?$/.exec(value);
  const descriptor = commandDescriptors.find(command => command.name === match?.[1]);
  if (!descriptor) throw new Error('Unsupported command; use /help.');
  return commandSchema.parse(descriptor.parse(match?.[2] ?? ''));
}
export function completeInput(prefix: string): string[] {
  if (!prefix.startsWith('/') || /\s/.test(prefix)) return [];
  return commandDescriptors.filter(command => `/${command.name}`.startsWith(prefix)).map(command => `/${command.name}`);
}
