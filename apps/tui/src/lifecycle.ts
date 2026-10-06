/** Local resources have independent cleanup obligations even when one earlier cleanup fails. */
export async function closeTerminalResources(resources: { settle: () => Promise<void>; unmount: () => void; closeJournal: () => Promise<void> }): Promise<void> {
  try { await resources.settle(); }
  finally {
    try { resources.unmount(); }
    finally { await resources.closeJournal(); }
  }
}
