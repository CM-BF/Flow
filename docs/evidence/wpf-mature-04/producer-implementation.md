# 普通 Claude 历史观察 producer

本片仅把普通、显式 Claude profile 的成功 root result 接到已有历史事件入口。实现 target、四源码、全部最终 raw 与固定输入由随后生成的 `producer-manifest.json` 唯一绑定；独立审批尚未开始。基准为受控合入固定 main `2f4a5789ee13937914fa2c25161c8d5ed1071550` 的 `844fa14bfbf32f5392e48e104b5440a9cb5b9b13`，同步前后与 integration release 见 `producer-integration-receipt.json`。writer d3a9be2b v8 仍有效，旧18源未改。

## 小 Interface 与状态归属

- `claude.ts` 沿原 Query、ownership/session ACK、coalescer、finally 管理执行。仅显式 profile、冻结 executionIdentity 且 runner 一致、无 steering/goal/graph 的普通 Claude 任务可读。第一成功 root result 后至多一次；同 session 的初始化 model 是 resolved identity，配置 alias 不是 resolved model。候选只在正常 EOF、原 final 校验与再次 ownership 检查后 emit，晚到冲突/stream error 不发布，后续 init model 改变永久丢弃候选。
- `readClaudeSummary` 接收同一个 Query 的可选方法，以及 host 提供的真实 observationId/nativeSessionId、resolvedModel、signal。只调显式 `{detail:'summary'}`，1000ms 等待与 abort listener 在函数退出时释放，迟到 rejection 有观察者，无发布 callback。该等待上限不是同步 CPU、OS 或整个 native 进程的硬终止保证。
- 既有 c173 `normalizeClaudeSummary` 仍是唯一 SDK 数值/类别归一化算法，公共 payload schema 负责跨 kind 安全整数约束。未知 host model 先以响应 model 做暂存值合法性检查，然后输出 null/空 categories；这不会把 SDK model 提升为 host identity。没有假 DB ref、文件路径、材料/工具名称或全文。
- helper 返回 available / unavailable / unsettled。缺方法、明确 reject/throw、非法数据仅 unavailable；pre-aborted 不调用 control，传播原取消。已发 pending 发生 abort/deadline 为 unsettled，caller finally 执行原 abort/close 后始终抛现有 `NativeExecutionError('unknown')`，即使 close 抛错；不能声称 void close 证明 child 已结束。session、ownership、emit/outbox 失败在 read catch 外直接传播。
- runtime、union、outbox、中心 store/027 完全复用且未修改。真实 id/sequence 来自原 outbox；中心仍通过原事务 authority 注入历史身份与真实 detail ref。没有新 scheduler、FSM、retry、full token-count 请求或采集后台任务。

## 验证及真实限制

最终五个显式路径 **121/121 不同**：19 read + 27 public adapter + 31 原 Claude + 11 原 stream + 33 原 runtime；0 skipped。局部严格 noEmit exit 0，继承 owner 根全部 strict/ES2023/noUnchecked 选项、递归真实 imports；所有 `@flow/*` 来自 owner tree。旧 Node child 启动测试通过临时 Node24 resolver 仅复用主仓已安装第三方，未装包/改包/造声明或产品 hook。配置与 resolver 内容已归档。

meaningful red 是 public adapter 1项因 summary 未调用失败（`producer-red.txt`）；更早 0 tests 配置错误不算 red。首次最终消费者组合120/121，唯一旧 fixture 首例3秒等待超时；不改源码、旧断言或时限的单项复核1/1通过（32未选），随后同五路径121/121通过。具体首次时序原因 unknown，不称无故障或删失败 raw；各轮重复不累计。新 fixture 初轮三项配置/ownership 断言问题与修正另见 `producer-development-checks.json`。

27 adapter 中的两个端到端局部测试通过 public `runRunner`、专用 loopback 动态端口、真实临时 journal/outbox，核连续事件 ACK、completed 后 admission 清除，以及 pending timeout+throwing close 保留 assignment、重启不领取/不执行/不 completed。全部临时 runner、socket 与目录由测试清理。只有 fake Query 与既有 synthetic Node child；0 PG、真实 SDK Query、provider、Codex、凭据读取、个人服务或新负载窗口。

这些检查不证明真实 SDK 成功 result 后控制通道仍可用、不证明 provider 无隐藏 I/O/费用，不提供 consumed-input/history cut；hard model capacity、current/remaining、压缩可追溯与 Web 仍待后继。本片产生历史观察，不能以事件 last_sequence 或累计账单推算当前上下文。真实 SDK 拒绝时没有 sample；控制结束未知时可能使已返回答案的任务保守保持 uncertain。

## 方法与工作段检查

2026-10-06 12:11 UTC，architecture_read / gpt-6-astra：沿本地 find-skills 发现与已固定 brainstorming 设计；读取 `/Users/citrine/.agents/skills/{find-skills,brainstorming,codebase-design,clean-code,tdd}/SKILL.md`。clean-code 固定用户指定 sickn33 源 `bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`、文件 SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`；本地原 frontmatter 的上游注记保持不改，不重装。

依根 `AGENTS.md#modular-design` 做小 Module 检查：helper 隐藏 SDK 等待/有限值校验，adapter 保留资源/候选生命周期，中心保留持久身份；没有复制 c173 算法或第二状态权威。TDD 以公开 adapter 的真实失败开始，以 helper、public adapter、真实 HTTP/journal 的行为断言验证；未删旧断言。命名、单一职责、错误优先级、资源释放和重复检查完成；32输入类别→最多4匿名 kind、safe integer、公共65536字节上限保留。已知限制为真实SDK可用性/current cut与旧fixture首次超时原因未知，均不隐藏。
