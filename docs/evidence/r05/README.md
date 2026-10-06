# R05-A 配置与 descriptor 提取

实现 target：`47e6943080a0d4713190c51dd5ffb234b8efd915`。基线：`d7e1e64e7792f4d1ad4933db042f10f266ad0cca`。独立审查尚未执行。

本片把现有 Claude manifest 解释、公开 profile 描述集中到 runner 私有模块，并给 fixture/Claude 返回本地版本化 descriptor。生产 main 消费 descriptor 选择 profile guard；现有加载器和 describeExecutionProfile 导出兼容。没有新增 SDK/harness、中心 schema 或生产权限，也没有改变 run()、终态、取消、S01 journal/容量和 A2A。

## 原始检查

| 证据 | 实际结果 |
| --- | --- |
| [install.txt](install.txt) | Node24 / pnpm frozen offline ignore-scripts；540 reused、0 downloaded；锁未改 |
| [descriptor-red.txt](descriptor-red.txt) | 新 Interface fixture 描述断言真实失败 1 项，旧 loader 尚无 harnesses 字段 |
| [descriptor-green.txt](descriptor-green.txt) | 同一断言修后 1/1 |
| [configuration-consumers.txt](configuration-consumers.txt) | 5 文件 42/42，4.61 秒；8 新 descriptor + 原 34 配置/profile/goal 直接消费者 |
| [typecheck.txt](typecheck.txt) | pnpm exec tsc --noEmit，exit 0，空 stdout |
| [preservation.json](preservation.json) | parser/重命名外 profile 描述/publish+guard 精确一致；12 关键依赖、root manifest/lock 原文相同 |

前面 red/green 的 1 项包含在最终 42 内，不重复累计。既有 startup 检查真实运行四个独立 main 子进程，覆盖 profile 接受/拒绝 × steering 开/关，profile 先于 claim，退出与日志凭据断言保留。goal SDK 测试使用已有注入实现，不调用真实 provider。测试自有临时目录、loopback 动态端口；未使用 PG、个人服务或用户浏览器。

重跑（在本 worktree，PATH 使用 `/opt/homebrew/opt/node@24/bin`）：

```sh
pnpm exec vitest run apps/runner/src/native-harness.test.ts apps/runner/src/configuration.test.ts apps/runner/src/execution-profiles.test.ts apps/runner/src/goal-tool-bridge/configuration.test.ts apps/runner/src/goal-graph-tools/sdk.test.ts
pnpm exec tsc --noEmit
```

[manifest.json](manifest.json) 绑定固定 source / 原始输出 / 直接消费者；[quality](quality.md) 记录技能与 clean-code；[Interface](interface.md) 记录字段与兼容性。

## 精确边界

- descriptor 是本机受信任 factory 的配置描述，不是能力探测或 grant。用户无法通过 manifest 提交 descriptor/ports 自授权。
- `publicProfile` 保持旧 JSON field order/hash 与未知能力语义；未新增或重解释 provider 的实际设置。
- `ports` 只描述既有 steering/goal/graph 的配置需求，runtime 继续现有 gate；旧 unpinned work 不继承 steering。
- 公开类型目前由本地直接消费者导入；未要求 index/client/根锁变更。
- 仍只有现有 fixture/Claude 配置，本片不声称第二真实 native adapter conformance。Pi、规范中心来源及 settled/unknown 是 R05 后继。
- 作者检查不代表独立批准或 main 集成；没有运行全库、DB 业务矩阵、真实模型、UI 或个人服务升级。
