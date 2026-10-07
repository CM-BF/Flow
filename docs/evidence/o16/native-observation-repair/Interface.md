# O16 私有声明与失败可观测性修复

本次仅修实验的声明策略与事实投影，不执行 SDK/auth/provider/PG。原 native-plan-20261007-1018 的 1 次调用、初始化拒绝、测量未知、费用 UNKNOWN 和 DB/tmp KEEP 全部保留，不回填原件。旧授权已消费，任何下一 query 均须新 GO 预算。

- 私有 recipe 使用本轮已保存 init 投影的完整 2 plugin / 2 skill 名单，并给出固定 policy 标识。O10/O08 历史 3/3 名单独立保留，不自动合并或学习名单。模型、runtime、tools、MCP、permission、重复或冲突声明继续严格检查；名单不授予执行能力。
- driver 在 plan/children 的失败或成功清理前均从 worker 的实际 SDK 入口计数投影。缺失或无效 worker 计数是 unknown；它不是供应商请求数或费用。confirm/decision 的已知零请求语义保持。
- 计量只持久受控 stage/code/constraint，不保存 I/O message/path。最早 observationFailure 不被后续失败覆盖，停止原因与 stop checkpoint 的 unknown 分开。边界数值、TERM/KILL 和删除权限不变。
- 最终计量从 durable resources.json 取 sourceDigest 与原目录身份，即使 stage.finish 失败也不丢此来源。缺件/身份不符/计量错误返回 metrics:null + failure，不从缺目录推 0；仅明确 directoryRemoved=true 可表示已删除。未提供目录的运行中采样标 runtimeState:unknown。

局部 7 新例：private 声明正例；未知/重复/模型/版本/tool/MCP/permission/冲突反例；early init rejected 仍 consumed1 且主错/cleanup 分离；missing worker unknown；final resource 缺件/错源/失败阶段原目录；受控 limit/I/O/无目录 unknown；supervision 首错与 checkpoint unknown。它们只用注入 query、纯数据和一个自有短 Node 子进程，不导入 SDK/native/driver，不重跑旧 15/16/26。

复用前一 run.py 的 OPS14 单 child caller，选中名称 O16 repair:，原总 60s / 2MiB tmp / 512KiB raw，fresh 保留 1GiB + 2MiB tmp + 512KiB raw。过程与原始输出只保存一份，失败保留并可在同工作段定向修复。新 source/bindings 仅记录本次差量；继承 native-environment-implementation/manifest.json 与 native-plan-20261007-1018/result-manifest.json，不再复制其 289 源/原 raw。

clean-code 安全点：责任仍在 config、query observation、driver projection 与 operator 计量，未新增 loop/FSM 或通用监督器。纯计量依赖注入仅用于直接故障验证；所有未知均保留而不构造成功值。新生产授权、普通 adapter 和已保留资源无改动。
