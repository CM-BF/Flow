import { useState, useSyncExternalStore } from "react";
import { themes } from "../../themes";
import type { PluginContext, PluginViewProps } from "../types";
export function activate(context: PluginContext) {
  for (const theme of themes)
    context.command(`flow.theme.${theme.id}`, {
      parse: () => undefined,
      run: async (_, command) => {
        await command.execute("flow.theme.set", { themeId: theme.id });
      },
    });
  function Appearance({ execute }: PluginViewProps) {
    const current = useSyncExternalStore(
      context.theme.subscribe,
      context.theme.getSnapshot,
    );
    const [error, setError] = useState<string>();
    return (
      <fieldset>
        <legend>Appearance</legend>
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            aria-pressed={current.themeId === theme.id}
            onClick={async () => {
              setError(undefined);
              const result = await execute(`flow.theme.${theme.id}`);
              if (!result.ok) setError(result.error);
            }}
          >
            {theme.label}
          </button>
        ))}
        {error && <p role="alert">{error}</p>}
      </fieldset>
    );
  }
  context.contribute("flow.theme.settings", Appearance);
}
