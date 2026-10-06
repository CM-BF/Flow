/**
 * Adapted from Vercel AI Elements Artifact (MIT), commit
 * 6a9d5b1822ffb10bba4bd97175f01edd7d8651cd, packages/elements/src/artifact.tsx.
 * Retains the composable display API; Flow semantic CSS replaces Tailwind/shadcn.
 * Unused tooltip/actions were omitted. See THIRD_PARTY_NOTICES.md.
 */
import type { HTMLAttributes } from "react";
const classes = (base: string, extra?: string) =>
  extra ? `${base} ${extra}` : base;
export const Artifact = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={classes("artifact", className)} {...props} />
);
export const ArtifactHeader = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={classes("artifact-header", className)} {...props} />
);
export const ArtifactTitle = ({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={classes("artifact-title", className)} {...props} />
);
export const ArtifactDescription = ({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={classes("artifact-description", className)} {...props} />
);
export const ArtifactContent = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={classes("artifact-content", className)} {...props} />
);
