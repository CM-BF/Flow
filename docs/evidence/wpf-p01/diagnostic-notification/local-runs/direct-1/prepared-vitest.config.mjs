export default {
  "root": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-diagnostics",
  "cacheDir": "/private/tmp/plugin-diagnostic-notification-20261008/direct-1/scratch/vite",
  "test": {
    "include": [
      "apps/web/test/plugin-host.test.ts"
    ],
    "name": "p01-diagnostics",
    "pool": "threads",
    "maxWorkers": 1,
    "fileParallelism": false,
    "isolate": false,
    "watch": false,
    "cache": false
  }
};
