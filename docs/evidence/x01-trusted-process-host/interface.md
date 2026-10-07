# Trusted process host Interface — design only

固定源码输入：`4fdd856293a502209d7509ea37da901bbfd89f72`；实际 Node 读取为 `v24.20.0`。所属 X01-04/05/07。当前只批准计划编写，以下全部是 proposed，0 产品实现/运行证据。

## 用户结果与现状

为明确受信的插件提供每 invocation 一个新 Node 进程，能够终止该纳管实例并获得独立 module 生命周期。旧模式保持现行为：host.ts:48–62 的 Abort 只结束观察，不能停止 import/invoke；host.test.ts:127–167 明确同材料 namespace 缓存及 pending unknown。新模式的两次调用各有新的 module state；这与旧模式不同，必须显式 opt-in。

这不允许运行任意不可信第三方包。当前没有 OS 文件、网络、子进程/后代、CPU/RSS 限制；Node permission model 也不保证恶意代码隔离。独立进程、环境清理和 bounded framing 不改变这些事实。不开放 physical removal；hostRelease 仍 unknown，不能把一个 child 已退出推成所有 namespace/后代/外部副作用已释放。

## 单一 Module 与真实 consumer

| Module / owner | Interface / 不变量 |
| --- | --- |
| `executePluginTool`，现 execution.ts:43–64 | 保持输入 binding 校验、artifact/provenance 与 PluginExecutionUnsettled；内部选择现 `invokeInstalledTool` 或新 `invokeTrustedProcessTool(input)`。业务 caller 不认识 IPC。 |
| parent runtime + AttemptControl | 唯一 runner token/FlowClient、当前 ownership、load/invoke 当前 grant、稳定 6 元组 authorization key、outbox 与 admission。现 runtime.ts:271–284、310–326 保持。 |
| 新 process-host Module | 只拥有一次子进程、帧、期限、诊断与资源 receipt；接受现 `PluginToolInput` 中原 closures，返回相同 `PluginToolResult` 或现 typed error。无第二 scheduler/client/授权数据库。 |
| 新 worker | 调用同一个 `invokeInstalledTool` 与 `readInstalledPackage`，authorize/assertOwnership 仅为窄桥接；没有 token、HTTP transport、outbox 或重试权。 |

最小内部 factory 候选是 `createTrustedProcessInvoker({ resourceRoot }): (input: PluginToolInput) => Promise<PluginToolResult>`；resourceRoot 由父 runner 的既有私有工作目录派生，0700 子目录/0600资源receipt。执行器内部从自身 Module/runtime identity 定位 Node/worker/loader，不允许配置任意 executable。factory 只绑定生命周期上下文，原 consumer 仍一次调用原结果 Interface。内部测试可替换有限进程原语，但真实行为测试必须走实际 child；不公开第二业务协议。

配置沿 owned-0600 `readPrivateJsonConfiguration`；现 root/storeId/allowedDigests 不变，新增可选 `executionMode: 'in-process' | 'trusted-process'`，缺省等于原 in-process。选择只能来自 operator 私有文件/显式受信 RunnerOptions，不能由插件 manifest、task 或公共 caller 选择任意程序。显式新模式而平台/运行工件不支持时拒绝启动插件能力；不静默回落。首片只覆盖已观察的 darwin/arm64 + Node v24.20.0；其他组合需独立验证。现 backend nodeIdentity 的 v24 大版本检查不足以声称所有 v24 新模式合格。

## 授权顺序与进程消息

默认 Node fork IPC 在 message listener 前已解析整包，不适合把 listener 的 schema 检查当接收字节上界。选择本 executor 专用的 length-prefixed UTF-8 JSON：parent 写 stdin，child 写独立 fd3；stdout/stderr 只作有限诊断。4-byte unsigned BE 前缀，先检查长度才分配帧缓冲/解码/JSON.parse；fatal UTF-8、strict schema、每方向单在途请求、写背压、不排无界队列。输入是流字节上界，不承诺 OS 单 chunk 分配或整个 Node heap 上界。

所有帧含固定 protocol、私有随机 invocation nonce、单调 sequence 和 binding/invocation/task/attempt/ownerVersion 身份。parent 用自己冻结的原 binding 构造真实授权，不采信 child 传来的新身份。协议只容纳 hello/init、ownership-check/reply、authorize(load/invoke)/reply、result/error、abort；重复/错序/未知字段/截断/多结果拒绝。最多 16 个完整帧/方向，5 次 ownership-check、2 次 authorize；严格顺序沿 host.ts:70–81，不提前批量授权或缓存一个 phase ACK 给下一 phase。parent 每次处理桥接及发送 ACK 前检查 Abort/ownership，worker 收到 ACK 后再过原 host ownership gate。阶段 timeout 沿现请求期限，不以总执行期限延长 authorization 请求。

load 请求前完成资源身份 receipt 持久化；load grant 后才动态 import。import 完成后仍需独立 current invoke grant；撤权/lease loss/取消在两 phase 之间必须阻止 invoke。已重放的 phase receipt 仍沿 execution.ts 原有拒绝规则，不在此片改变未知恢复。

| 接收限制（新模式策略） | 推导与口径 |
| --- | --- |
| init ≤192 KiB | input 原16 KiB UTF-8 最坏 JSON 转义≤96 KiB；configuration 已编码 JSON≤16 KiB；root≤4096 UTF-16 units 最坏≤24 KiB；artifact/UUID/nonce/store/协议与标点保守≤8 KiB，总≤144 KiB。parent 先核原 allowlist，再只发送所选已授权 digest，不复制512项名单。实现必须在真实 encoder 输出复核总长，测试最坏 escape。 |
| result ≤128 KiB | content 原16 KiB UTF-8 最坏≤96 KiB，加受限 provenance/标点远低于余量；身份必须精确等原 binding/material。 |
| control ≤4 KiB；每方向总≤256 KiB | 固定短 error code，不跨帧传任意 Error/stack。init/result 特例各仅1帧；message count 与累计字节均硬拒绝，空白也计。 |
| stdout+stderr 合计≤16 KiB | drain 两管，溢出触发停止并保首失败；不把原 input/config/token 写诊断。不得日志截断后冒完整成功。 |

帧限制覆盖合法现16 KiB工具文本与config。若实现发现合法身份编码超过推导，先修计算/设计，不默删字段或缩小旧 public Interface。

## 环境、材料与发布

绝对 Node executable 来自当前 verified runtime identity，显式空 execArgv 重新组成必要的受信 loader 参数；不继承 process.execArgv/NODE_OPTIONS/NODE_PATH。env 使用固定 allowlist（PATH仅系统目录、LANG、own TMPDIR/HOME、关闭 compile cache），无 runner token、FLOW_*、proxy 或无关 secret。配置/输入仅发送本 invocation 明确需要的值。cwd 为独立 owned scratch，不是用户项目或材料目录；material root/entrypoint 只能经原 store reader 得出并校验，不能接受 child 或任务自报路径。

实际 release 是固定 Git source archive + Node/tsx，不是 esbuild bundle：backend-release/build.mjs:9,22–28,43 包含 apps/packages/tools，preview.mjs:262 用 Node/tsx 启动 runner。动态 worker 必须是 tracked source，在最终 artifact inventory 有固定 bytes/hash；worker URL 锚定 runner Module 的 import.meta.url。tsx loader 由同 artifact 的 module-relative dependency resolver取得绝对入口，不能从 scratch cwd/全局包/开发仓库解析。具体 loader export 解析应在实施时读已安装固定 tsx package exports 后选定，并纳入 release test 输入；不得凭计划假设开发 `.js`→`.ts` 解析在脱离仓库后成立。

发布验收必须由原 release owner 提供受控、可重定位的真实工件：在仓库源码和全局 node_modules 不可作为输入的 cwd，启用新模式，真实 worker load/invoke 一次并核 entry/runtime/inventory；缺 worker 或 loader 时明确失败。仅 dev tsx 测试通过不可勾发布闭包。dependency-plan 的 apps/server+apps/runner 根与现有 tsx hostToolSources 应优先沿既有闭包核对；首片无需更改 builder 的 archive 规则；若该验收证明规则/依赖计划缺项，再协调对应 exact leaf。

## 终态、取消与未知

初始策略候选为 work≤10s、TERM grace≤1s、KILL grace≤1s、最终记录≤1s（13s 单 invocation 预算），外层 runner shutdown 取其更早期限；不是硬实时或 RSS 限制。只通过本次创建且仍具确定身份的 child handle 发信号，绝不扫描/按任意 PID 杀进程。最窄首片仅纳管 direct child，不以 process group closure 推断逃逸后代不存在；新模式信任前提明确禁止插件创建长期子进程，但当前没有 OS 强制能力，不能据此证明无后代。

`result`、child exit、协议 EOF、stdout/stderr EOF、资源身份及业务 effect 是不同事实。仅有效单结果 + exit0 + 所有捕获 EOF/完整字节 + 确定 direct-child closed + 最后 parent ownership 检查通过，才交回成功结果供原 execution/outbox 使用。若结果已收到但 child 未闭合/清理未知，保留 primary 与资源 identity，返回 unsettled；不提前发布成功。diagnostic 截断/错帧/身份变化/信号失败/最终所有权未知均不能提升为 closed。初始可恢复的观察未知和最终事实分开记录，不吞历史。

parent cancellation/shutdown/失权会请求 abort 并按有界策略停止自己的 child。load 已获准后即可能有副作用：即使最终确认进程已死，业务仍可能 OUTCOME_UNKNOWN，不能自动换 key/重发/声称撤回。错误/cleanup 次失败不能覆盖原非 Error 失败。无主失败而 cleanup 失败也不能报成功。

parent 硬崩溃/SIGKILL 不保证 child 同时死亡，尤其 child 无限循环时不能依赖 EOF handler。实施要在 load grant 前持久化小型 resource receipt，关联原 admission assignment 与 nonce/启动身份；它只记录资源，不复制业务状态。重启仍由原 journal/outbox决定未知，未闭合 receipt 阻止新模式再次执行该 assignment；不得按裸 PID 自动清理或重放。恢复/确切身份验证是明确后继，不把首片 graceful shutdown 测试充作 crash cleanup 证明。

## 复用与非目标

OPS14 的 supervision Report/终态口径可直接用于外层局部验收；其同步 Python supervisor 使用 stdin=DEVNULL，不是交互式 Node 两阶段 transport，不能冒直接复用。production 必需的 child/pipe 实现只封装这个 executor，不扩成通用 supervisor。personal-preview/process.mjs 面向长驻发布服务、stdio ignore，也不导入 runner。既有 token、AttemptControl、package store、host、授权 key、provenance 与 outbox 全复用。

第三方安全沙箱后继必须另有 OS 文件/网络/后代/资源策略与平台验证；本片没有该权限，也不以 vm/Worker/ErrorBoundary/Node permission model 替代。无新 server API、DB/migration、public DTO、物理卸载、第二 runner 或 scheduler。

## 官方版本依据

[Node v24.20 child_process](https://nodejs.org/download/release/v24.20.0/docs/api/child_process.html) 说明默认 env/execArgv、IPC message 解析、pipes 背压及 signal 不等于终止；[v24.20 permissions](https://nodejs.org/download/release/v24.20.0/docs/api/permissions.html) 明确恶意代码保障限制。本设计未采用24.21能力。官方文档只是设计输入，未代替本机实际验证。
