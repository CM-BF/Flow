# P03 A2A 状态读取证据

实现固定于 `61d1192140d53c195f7d736d12e26932c9a5c0d5`，base `ac4e34de2331dce276440df8969883c1883060ef`。模型 gpt-6-astra ultra；独立 worktree `protocol-payload`，claim `f61ea3f3-f3dd-4d4c-a322-f05a4fb84c77` v1。[checks.json](checks.json) 绑定六源码 SHA-256、确切命令、各退出码和原始日志 hash；[依赖解析](dependency-resolution.json) 证明 @flow/client/contracts/protocols 指向本 worktree，复用的外部 SDK 固定 1.3.0，未改 lock/依赖版本。

`A2APeer.snapshot` 保留字符串任务 ID 默认语义，也接受显式 `{ id, historyLength }`；RequestOptions 仍独立。Runner 仅在 SendMessage configuration 与 GetTask 请求设置 `historyLength: 0`。取消、单次发送 permit、材料导入、租约算法、公共中心 API/FSM 不变。依据 [A2A 1.0 §3.2.4](https://a2a-protocol.org/v1.0.0/specification/#324-history-length-semantics)：未设置采用 server 默认，零请求省略 history，正数请求最近 N 条。

## 实际验证

21 个不同用例通过：protocol 6 + runner 15。首片 2 个用例包含在 protocol 6 中，不重复相加。Node24.20.0、pnpm9.15.4、Vitest4.0.18。局部 typecheck exit0，精确起止和命令见 [typecheck-result.json](typecheck-result.json)；空 typecheck stdout 是正常成功输出。

- [protocol-regression.log](protocol-regression.log)：6/6，0.648s。真实动态端口 HTTP、官方 SDK handler/store，未设置/零/正数2，默认 snapshot 与 observe 初次/终态竞态回退保留 history，丢 ACK 不重发与 endpoint 拒绝原断言保留。
- [runner-green.log](runner-green.log)：15/15，25.76s，实际 PG 生命周期 UTC 2026-10-06T03:56:59.787Z–03:57:24.968Z。真实 center、独立 runner 子进程、生产 CLI/server/runner 入口；原恢复、未知结果不重发、取消待确认、artifact 去重与独立验证、租约与目录/endpoint 失败退出断言全部保留。
- Runner 1,024 条历史案例的实际 HTTP 请求拥有 historyLength 字段且值为0：SendMessage 回复179字节、GetTask工作态170字节、完成态含artifact296字节，解码history为0；原 artifact 全文及SHA-256版本 `fee6a0cc9cbb009e4fb58af1bb7def7e7fa48c47527676b5c0224c60f8298601` 完整一致。
- 每次 runtime 运行创建独立随机名称数据库，只在创建成功后清自己的 schema；afterAll 删除自己的库并查询 remaining=0，admin pool finally 关闭。三次运行原始日志均含创建/清理回执。未触 flow_p02 或他人端口/DB；HTTP 动态端口，子进程与临时目录均自有。

官方 handler 同一固定任务版本，完整16KiB中文/emoji artifact，两组各一次（非延迟分位实验）：

| 合成 history 消息数 | 默认响应 UTF8 字节 | 显式0响应 UTF8 字节 | artifact/status |
| --- | ---: | ---: | --- |
| 1 | 18,708 | 16,580 | 完整相等 |
| 1,024 | 2,185,338 | 16,580 | 完整相等 |

字节来自 HTTP server 实际序列化 JSONRPC body 的 `Buffer.byteLength(..., 'utf8')`；不含 HTTP headers。每条合成 history 是中文/emoji重复128次，两组使用相同task ID/status/artifact。默认与零除history外整个解码Task相等；正数2返回最近最多两条，零在原始wire明确保留并省略响应history字段。

这证明受控官方 peer 对省略 history 的请求减少传输及解码后的历史数量，不是未知第三方的服从保证，不是总响应字节硬上限、CPU或时延提速、模型token节省或agents容量。artifact仍完整导入；既有guardedFetch响应大小/超时保护保留。功能运行位于有背景负载的共享主机，时长只记执行过程，不作为性能/SLO证据。0模型、0新云、0用户文件。

## 红绿与失败保留

1. [protocol-red.log](protocol-red.log)，exit1：新增测试的采样器错误地对错误响应中缺失result调用Object.hasOwn，造成未处理错误及15秒超时。已改为安全检查；此轮不算目标行为red。
2. [protocol-red-corrected.log](protocol-red-corrected.log)，exit1：正确red，旧snapshot把选择对象转成`[object Object]`任务ID，官方peer返回TaskNotFound。增加兼容选择后 [protocol-green.log](protocol-green.log) 2/2、exit0。
3. [runner-red.log](runner-red.log)，exit1：新增断言误用不存在的digest字段；查公开ProtocolArtifactReceipt后更正为承载摘要的version，未改生产材料代码。
4. [runner-red-corrected.log](runner-red-corrected.log)，exit1：正确red，真实HTTP缺少historyLength属性。两轮均以`-t`仅选择一条用例，14 skipped只是定向红阶段未选择；最后完整runtime15/15无skip。
5. 最小Runner两处选择0后完整runtime通过；未为通过删除旧断言或扩大生产范围。

## Review / 架构 / 接收

Mika 独立只读 review APPROVED，绑定上述实现 SHA，无 findings；检查六文件/调用路径、源码hash、原始日志及资源清理，未独立重跑测试或benchmark。详见 [review.md](../../../plans/p03-protocol-payload/review.md)。任务进度唯一来源 [status.md](../../../plans/p03-protocol-payload/status.md)。

Interface 扩展与 Runner 内部读取选择已改变；公共中心接口/FSM/外部依赖版本不变。工程 dashboard 架构 target A2A client/runner poll 说明待 Execution Lead 于接收时更新固定main基线。P03 尚未集成main；不以分支验证代替main。claim继续保留review/接收期。
