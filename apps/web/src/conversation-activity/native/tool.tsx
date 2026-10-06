// Adapted from vercel/ai-elements@6a9d5b1822ffb10bba4bd97175f01edd7d8651cd Tool.
// Apache-2.0; source and full license: docs/evidence/wpf-activity-i01/.
// Native observation states replace AI SDK streaming states; no synthetic animation or timing.
import { CheckCircleIcon, ChevronDownIcon, CircleIcon, WrenchIcon, XCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";
import type { NativeActivityReference } from "@flow/contracts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible";
import { cn } from "../../lib/utils";
export const Tool = ({ className, ...props }: ComponentProps<typeof Collapsible>) => (
  <Collapsible className={cn("group not-prose mb-2 w-full rounded-md border", className)} {...props} />
);
export function ToolHeader({ title, state }: { title: string; state: NativeActivityReference["status"] }) {
  const label = state === "unknown" ? "Outcome unknown" : state.replaceAll("-", " ");
  const Icon = state === "succeeded" ? CheckCircleIcon : state === "failed" ? XCircleIcon : CircleIcon;
  return <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-left">
    <span className="flex min-w-0 flex-wrap items-center gap-2"><WrenchIcon className="size-4 shrink-0 text-muted-foreground" /><span className="break-words text-sm font-medium">{title}</span>
      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"><Icon className="size-3" />{label}</span></span>
    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
  </CollapsibleTrigger>;
}
export const ToolContent = ({ className, ...props }: ComponentProps<typeof CollapsibleContent>) => (
  <CollapsibleContent className={cn("space-y-3 p-3 text-foreground outline-none", className)} {...props} />
);
