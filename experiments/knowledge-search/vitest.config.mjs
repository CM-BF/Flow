export default { cacheDir: process.env.FLOW_K01_QUERY_CACHE, test: { include: ['corpus.test.ts'], pool: 'threads', maxWorkers: 1, minWorkers: 1, fileParallelism: false } };
