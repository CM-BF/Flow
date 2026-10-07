# ENG01J 交付证据

固定产品 `324d62267d31273683b4720501a3fbde137225ce`，五源；基线 `ee98e65c147cf2ef28ccf0f519952f60d56e9d4b`。真实 Darwin 受限启动与 R06 factory 直接消费者，待独立审查。

- [Interface](interface.md)：职责、实际启动、FD缺口与未授生产 grant。
- [局部原始记录](local/README.md)：五轮、4个不同检查、types红后绿、两个原失败与所有清理。
- [单份运行汇总](local/run.json)：3569ms / 5126B；0PG/Chrome/provider/install。
- [固定源码输入](source-inputs.json)、[补充只读输入](focused-inputs.json)、[已安装入口](installed-entries.json)。
- [最终绑定](manifest.json)：固定产品、保护基线、原始与派生证据；自身manifest不循环绑定。
- [技能/作者质量复核](quality.json)、[唯一status](../../../plans/eng01j-native-write-authority/status.md)。

本片不是生产 NativeWriteAuthority grant，也没有把 `writeAccess: unknown` 当 revoked。实际二进制/模型/no-fallback、provider网络、任意IPC、目标写入大小强制与完整writer撤销仍开放。仅对实际覆盖操作给OS事实，固定策略不宣称全平台隔离。
