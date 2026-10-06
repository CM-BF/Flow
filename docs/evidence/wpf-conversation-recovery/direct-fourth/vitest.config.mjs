export default {
  "root": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery",
  "cacheDir": "/private/tmp/recovery50-once-en2_sud5/scratch/cache",
  "test": {
    "include": [
      "apps/web/test/conversation-recovery.test.ts"
    ],
    "pool": "forks",
    "maxWorkers": 1,
    "fileParallelism": false,
    "cache": false,
    "testTimeout": 1500,
    "hookTimeout": 1500
  }
};
