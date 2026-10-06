# 固定局部检查请求

入口（未运行）：`python3 docs/evidence/chat06p03/check-once.py --mika-approved-once`。显式窗口许可前不调用。driver只允许一次wx预约，以同一monotonic起点限制全部red→已准最小修改→green→strict≤30s，raw≤2MiB；实际结束receipt/CLI分别记录，不把检查间人工时间排除。fresh可用≥1,107,296,256B，否则0检查。不跑PG/provider/SDK/app/安装。

三个实际命令均固定Node24：
- `/opt/homebrew/opt/node@24/bin/node /Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/vitest.mjs run --config docs/evidence/chat06p03/vitest.config.mjs --configLoader native --reporter=json apps/runner/src/assistant-stream/accumulator-incremental.test.ts -t 'public coalescer preserves'`（最多8s；预期唯一字节断言0≠294912失败才实施）
- 同命令不含`-t`，全部5专测（最多10s）
- `/opt/homebrew/opt/node@24/bin/node /Users/citrine/Projects/AgentHarness/Flow/node_modules/typescript/bin/tsc --noEmit --project docs/evidence/chat06p03/tsconfig.json`（最多8s）；严格继承全部root选项，仅缩include/指定既有第三方types。

输入预算：主样本每实现21帧、正文delta+完整assistant共131072B；red+green双方累计84帧和524288正文B。Unicode/重复/late aborted full/多块/superseded34帧，empty/result14帧，abort/error8帧，受控truncated8帧，预计合计148帧；短header envelope逐JSON计入，静态保守总量<655360B，实际runtime每次yield以前用saved Buffer.byteLength计入共同≤1048576B/256帧。green从red测量继承计数。原大于窗口的stream.test.ts没有选择/删除/改写。

config产品闭包为本树10个源；冻结baseline的两文件仍同原相对深度，公有合同不替换为main。测试仅低limit case同时mock该公共合同的两个常量；其余case全生产常量。外部直接依赖既有main public安装Vitest4.0.18/TypeScript5.9.3/Zod4.6.5/SDK0.3.290纯types/@typesNode24.19.1；pnpm9.15.4为repo固定packageManager，无安装或全库构建。无新dependency/loader/framework。

所有global spy在finally/afterEach恢复，Hash.update/byteLength计数器用saved原函数以免自污染；比较实际总输入含相同frame指纹和id开销。精确原输出用toEqual完整比较；不从计数字节推导CPU/SLO。生产改动仅Block/seal，publiccoalescer仍原blob。
