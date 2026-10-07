import { z } from 'zod';
const text = z.string().min(1).max(16_000).refine(value => value.trim().length > 0 && Buffer.byteLength(value, 'utf8') <= 64 * 1024);
const cursor = z.string().min(1).max(128).optional();
export const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('help') }),
  z.strictObject({ type: z.literal('conversations'), after: cursor }),
  z.strictObject({ type: z.literal('open'), id: z.uuid() }),
  z.strictObject({ type: z.literal('profiles'), after: cursor }),
  z.strictObject({ type: z.literal('settings'), after: cursor }),
  z.strictObject({ type: z.literal('settings-page'), number: z.number().int().min(1).max(24) }),
  z.strictObject({ type: z.literal('setting'), profileId: z.uuid(), choice: z.number().int().min(1).max(32) }),
  z.strictObject({ type: z.literal('setting-clear') }),
  z.strictObject({ type: z.literal('new'), title: z.string().trim().min(1).max(180).default('Terminal conversation'), profileId: z.uuid().optional() }),
  z.strictObject({ type: z.literal('send'), text }),
  z.strictObject({ type: z.literal('turn'), number: z.number().int().min(1).max(2147483647) }),
  z.strictObject({ type: z.literal('page'), number: z.number().int().min(1).max(2048) }),
  z.strictObject({ type: z.literal('activity'), next: z.boolean().optional() }),
  z.strictObject({ type: z.literal('detail'), number: z.number().int().min(1).max(20) }),
  z.strictObject({ type: z.literal('reply') }),
  z.strictObject({ type: z.literal('back') }),
  z.strictObject({ type: z.literal('queue'), next: z.boolean().optional() }),
  z.strictObject({ type: z.literal('pause') }),
  z.strictObject({ type: z.literal('resume') }),
  z.strictObject({ type: z.literal('cancel'), taskId: z.uuid() }),
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
  { name: 'settings', usage: '/settings [cursor]', description: 'Read finite Claude message settings choices; provider support remains unprobed.', parse: after => ({ type: 'settings', ...(after.trim() ? { after: after.trim() } : {}) }) },
  { name: 'settings-page', usage: '/settings-page <number>', description: 'Show eight choices from the loaded catalog; no request.', parse: number => ({ type: 'settings-page', number: Number(number.trim()) }) },
  { name: 'setting', usage: '/setting <profile-id> <choice>', description: 'Select a complete allowed tuple for the next message in the current conversation.', parse: argument => { const parts = argument.trim().split(/\s+/); if (parts.length !== 2) throw Error('Use /setting <profile-id> <choice>'); return { type: 'setting', profileId: parts[0], choice: Number(parts[1]) }; } },
  { name: 'setting-clear', usage: '/setting-clear', description: 'Clear the unsent selection; unresolved requests remain immutable.', parse: noArguments('setting-clear') },
  { name: 'new', usage: '/new [--profile <id>] [title]', description: 'Create a conversation; does not itself start a model.', parse: argument => {
    const match = /^--profile\s+(\S+)(?:\s+([\s\S]*))?$/.exec(argument.trim());
    return { type: 'new', title: (match ? match[2] : argument)?.trim() || 'Terminal conversation', ...(match ? { profileId: match[1] } : {}) };
  } },
  { name: 'send', usage: '/send <text>', description: 'Submit a follow-up; configured execution may call a model.', parse: value => ({ type: 'send', text: value }) },
  { name: 'turn', usage: '/turn <number>', description: 'Observe one loaded turn.', parse: number => ({type:'turn',number:Number(number.trim())}) },
  { name: 'page', usage: '/page <number>', description: 'Read a bounded text page; /back follows latest body.', parse: number => ({type:'page',number:Number(number.trim())}) },
  { name: 'activity', usage: '/activity [next]', description: 'Read activity references; no bodies yet.', parse: argument => { if (argument.trim() && argument.trim() !== 'next') throw Error('Use /activity [next]'); return {type:'activity',next:argument.trim()==='next'}; } },
  { name: 'detail', usage: '/detail <number>', description: 'Expand a reference from the current activity page.', parse: number => ({type:'detail',number:Number(number.trim())}) },
  { name: 'reply', usage: '/reply', description: 'Read the complete recorded final reply.', parse: noArguments('reply') },
  { name: 'back', usage: '/back', description: 'Return to assistant text.', parse: noArguments('back') },
  { name: 'queue', usage: '/queue [next]', description: 'Read a bounded queue page; no item bodies.', parse: argument => { if (argument.trim() && argument.trim() !== 'next') throw Error('Use /queue [next]'); return { type: 'queue', next: argument.trim() === 'next' }; } },
  { name: 'pause', usage: '/pause', description: 'Pause later queue promotion; current execution continues.', parse: noArguments('pause') },
  { name: 'resume', usage: '/resume', description: 'Explicitly resume from the observed queue/task identity; may start configured execution.', parse: noArguments('resume') },
  { name: 'cancel', usage: '/cancel <displayed-task-id>', description: 'Request cancellation of the displayed task; acknowledgement is not proof of stopping.', parse: taskId => ({ type: 'cancel', taskId: taskId.trim() }) },
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
