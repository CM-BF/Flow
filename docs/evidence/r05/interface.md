# R05-A Interface

固定源基线：d7e1e64e7792f4d1ad4933db042f10f266ad0cca。正式合同在 packages/contracts/src/native-harness.ts，当前不改公共 index。

ConfiguredNativeHarness = { adapter: HarnessAdapter, descriptor: NativeHarnessDescriptor }。
descriptor = { protocol: 'flow.native-harness.v1', harness, adapterVersion, ports, publicProfile }。
ports 仅 { steering?: 'flow.active-steering.v1', goalTools?: 1, goalGraphTools?: 1 }，表示现有配置需要的 host ports；不是 provider 能力证明或权限 grant。fixture ports={}、publicProfile=null。没有 wire endpoint/DB schema 变化。

私有 native-harness 模块负责现有 Claude JSON manifest 的验证、createClaudeAdapter 与 profile 描述；主 loadRunnerConfiguration 保留绝对小文件约束和旧返回字段，新增 harnesses 供真实 main 消费。旧 describeExecutionProfile 导出作为兼容 alias 保留，现有 tests/调用方无需迁移。宿主 publish/guard 逻辑原样保留。

不将 descriptor 序列化进 profile，不改变旧 hash/参数默认值/ordinary 字符串路径。不修改 HarnessAdapter.run Promise<void>、runtime terminal、A2A、S01 journal或型别枚举；settled/unknown 另独立后继。未知 manifest 字段继续 fail-closed，不对外接收用户提供 descriptor。

验收 seam：现有配置加载/guard、真实 main 子进程，外加 descriptor 返回内容与版本。无需新依赖、export 或 client/server 接线。
