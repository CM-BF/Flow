# Flow Runner

默认运行确定性 fixture。注册 runner 时声明它实际启用的 harness，并配置中心发放的 runner token 与独立私有工作目录：

```sh
FLOW_URL=http://127.0.0.1:4310 \
FLOW_RUNNER_WORKDIR=/absolute/private/flow-runner-state \
pnpm runner
```

`FLOW_RUNNER_TOKEN` 通过当前进程环境提供，不放进仓库或材料清单。SIGINT/SIGTERM 结束常驻循环；中心把尚未确认结束的 attempt 视为待核对，不伪装成用户取消。

普通 fixture/Claude 宿主可用 `FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS` 设置本地同时执行上限，接受十进制整数 `1` 至 `16`，默认 `1`。中心仍独立限制 runner 注册时的 `capacity`；仅提高其中一项不会提高另一项。A2A 入口和专用工程 setup 目前只接受本地上限 `1`。`16` 是程序配置上限，不代表已测得的吞吐或模型并发能力；容量结论需绑定具体场景与[容量计划与证据](../../plans/s01-runner-capacity/status.md)。

## 显式启用 Claude

在项目外创建仅 operator 可写的 JSON 材料清单，例如 `/absolute/private/claude-materials.json`：

```json
{
  "materialFiles": ["/absolute/task-materials/input.txt"],
  "model": "sonnet",
  "maxTurns": 4,
  "maxBudgetUsd": 1,
  "timeoutMs": 90000,
  "requireReadApproval": false
}
```

将 runner 注册为支持 `fixture` 和 `claude`，在上述启动环境额外设置：

```sh
FLOW_CLAUDE_MATERIALS_FILE=/absolute/private/claude-materials.json pnpm runner
```

需要已在本机完成原生 Claude 登录。入口不读取或打印凭据、不修改登录设置。材料清单是该 runner 的 operator 授权范围，每个 Claude task 都会获得该清单的私有快照路径；不同材料集应使用独立配置和 runner。路径必须是绝对路径，最多 32 个，每个最多 1 MiB。清单最多 16 KiB，未知字段被拒绝。空清单或 `allowRead: false` 启动无工具会话，适合同 host session 恢复。`requireReadApproval: true` 使用中心持久 decision，再次核对租约后允许读取。

模型只开放 `Read`，且每次 PreToolUse 重新检查所有权和材料快照的 canonical 路径。shell、网络、写工具和未知工具不可用。提示作为普通文本传递，SDK 不展开 `@path` 或执行斜杠命令。SDK 自身仍会在本机保存 native session；这不是操作系统沙箱，也不承诺清除组织管理的资源。实际发现的 model/runtime/tools/plugins/skills 会写入 session 详情。材料、产物与待核对事件保留在私有工作目录，清理由 operator 的保留策略管理。

本节 Claude adapter 当前每次 query 限制为最多 4 turns、SDK 估算预算最多 USD 1、超时最多 90 秒；配置只允许降低这些上限。这些单次运行限制与历史 probe 的调用次数授权分别管理。取消和超时使用 SDK AbortController 并清理 query。执行完成由 runtime 统一确认，adapter 不发送 completed。结果保存后读取并执行固定 `flow.text` v1；验证失败与执行失败分开。

原生恢复需明确 session ID、同 runner/host 的本地历史。恢复累计 modelUsage 的基线缺失时上报 unknown，中心显示用量不完整；SDK cost 是估算，不能视作账单。权限拒绝详情保留原因/数量，不保留原始工具输入。

## 程序入口与验证

`runRunner({ baseUrl, token, workingDirectory, signal, adapters, maxConcurrentAttempts })` 支持注入 `createClaudeAdapter({ materialFiles, ... })`；`loadRunnerAdapters(manifestPath?)` 与普通入口使用同一配置规则。默认 `runRunner` 仍只包含 fixture。

`pnpm check` 运行模拟 SDK / loopback HTTP 回归，不会启动真实模型。`apps/runner/probes/native.ts` 是需要明确预算的手工证据工具，不属于测试套件。R02/I01 当时的单次证据窗口已用完并封存，不能重放或沿用该授权；后续真实 probe 需独立明确的预算与证据记录。历史额度不等于产品并发上限，也不改变当前 Claude adapter 的单次运行限制。

实际模拟与真实结果、当前限制见 [R02 evidence](../../docs/evidence/r02/README.md)，状态见 [R02 status](../../plans/r02-native-harness/status.md)。
