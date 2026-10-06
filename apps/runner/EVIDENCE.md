# R01 实现与质量证据

Owner：runner_owner / gpt-6-astra。Worktree：`/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-runner`；branch：`codex/m1-runner`。基线 F00 `542f70b`，已同步 client `3995ec1` 与计划协作 `edca9fc`。本记录的开发结果不代表 main 已集成。

## 技能发现与实际应用

- 任务/stack：Node 24、TypeScript、Vitest、HTTP runner/harness 生命周期。已先读本地 `/Users/citrine/.agents/skills/find-skills/SKILL.md`，查本地技能、skills.sh，再使用 skills CLI 1.7.0 查找 `claude agent sdk typescript`。
- 本地采用 `codebase-design/SKILL.md`：runtime 的小 Interface 隐藏心跳、事件确认和取消；fixture 是可替换 adapter，不让 SDK 类型进入中心。
- 本地采用 `tdd/SKILL.md` 及 `tests.md`、`mocking.md`：已批准公开 runner/HarnessAdapter/HTTP Seam；正常、decision、cancel、失联、重报、verification-failure、failure、large 逐行为观察失败后实现，再保持回归通过。
- 本地采用 `brainstorming/SKILL.md`：对照已经批准的 FLOW-003/F00 架构和正式 R01 派工，不新增审批或扩大范围。
- 固定 clean-code 来源 `sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5`，路径 `/Users/citrine/.agents/skills/clean-code/SKILL.md`，SHA-256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`。已读且核验，未重装。
- 专用候选 `melodic-software/claude-code-plugins/agent-sdk-development` 仅把工作转交另一个文档 skill（37 installs / 22 stars），无本轮额外价值，未安装。SDK 官方资料和固定版本研究只用于 R02 准备；R01 无模型调用。

## 检查记录

| UTC 时间 | 范围与发现 | 修复/检查 | 剩余项 |
| --- | --- | --- | --- |
| 2026-10-06 00:49 | F00 Interface 最终只读复核；usage基线、连续ACK、恢复归属、生命周期责任已明确 | R01可开工，无接口阻塞 | 实际runtime实现 |
| 2026-10-06 00:58 | 第一工作段；发现失联引发SDK风格AbortError不能被当成用户取消、最终ACK丢失必须保留原ID | 独立AttemptControl、EventOutbox和verifier；失联原因独立于异常类型；固定ID磁盘重报；14条HTTP接口测试通过 | 入口、资源清理、拒收保留、用量样本边界和交付复核 |
| 2026-10-06 01:03 | 交付前 clean-code：检查命名、职责、Interface、错误路径、重复、必要复杂度与行为测试；发现迟到心跳可能重建计时器、重复决策可能发两次、上传大详情后写入需重新gate | 结束时关闭并中止心跳；相同decision ID复用等待Promise；产物写入前重新核对所有权；存储错误明确退出，不伪作模型失败；19条runner测试与4条公共测试通过，类型检查通过 | 等待独立review、C01真实中心联调；无已知本轮阻塞项 |

测试只使用 loopback 动态端口和独立 `/tmp/flow-runner-test-*` 目录，无固定端口、无共享数据库、无凭据输出。`pnpm install --frozen-lockfile` 成功；未新增依赖或改写根锁文件。真实中心/PostgreSQL联调、真实harness、跨机恢复、容量仍未验证。

## 可启动 Interface

`runRunner(options): Promise<void>` 从包入口 `@flow/runner` 导出；配置为 `baseUrl`、`token`、`workingDirectory`、外部 `signal`，可选 adapters、轮询/心跳/请求超时及结构化 `onNotice`。默认只有 fixture adapter，一个进程同时执行一个 attempt；runner 注册时只声明 fixture。

从工程根目录运行 `pnpm runner`。入口读取 `FLOW_URL`（默认 `http://127.0.0.1:4310`）、必需的 `FLOW_RUNNER_TOKEN` 与 `FLOW_RUNNER_WORKDIR`。SIGINT/SIGTERM 停止常驻循环，未完成的执行由中心租约进入待核对；停机不冒充用户取消。

正常执行、故意失败、验证失败、慢执行、大详情和等待决策均由 fixture 明确标记为模拟。`flow.text` v1 对保存后重新读取的产物校验；nonempty 使用 trim 后非空，contains 使用字符串包含。失败验收与执行成功分别上报。

## 最终行为覆盖

`PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm test`：23/23 通过，其中 R01 19 条；`pnpm typecheck` 通过；`git diff --check` 通过。

- 真实 loopback HTTP 领取、session/usage/产物/指定verifier/completed，固定 SHA-256 与 inputDigest 字面值核对。
- durable decision 批准/拒绝、等待时取消、相同 decision ID 合并；取消只在 adapter 退出后发终态。
- 心跳失联、悬挂请求期间独立租约过期、新动作停止；外部停机不生成取消或成功。
- 最终 ACK 丢失重复投递保持相同ID/内容；runtime重建读取本地待确认记录，不重新运行adapter；过期拒收后保留 uncertain evidence。
- 六种fixture状态、512 KiB折叠详情、2 MiB序列化批次和待确认数据上限；超限输出明确失败。
- 用量权威source、new-session/unknown/sample基线、同sample ID不同event ID的传递保持；中心账本的累计去重算术由C01验证。
- 独立Node进程环境配置启动和SIGTERM退出；输出和持久记录不包含测试runner凭据。

尚未宣称主机掉电持久性或在途工具副作用可撤回。每个attempt的待确认事件记录有界；历史产物及拒收后的待核对证据保留在runner工作目录，不自动删除，磁盘保留策略属于后续运维工作。
