# TUI01F-03 固定运行入口的文件级准备

2026-10-06 17:02 UTC。source `40508f18432ffc20eadd638b208841a364c72bea`；后台固定 `a89f42ab57acb53657af6a2d1b745dabd4d50aa5`；metadata 前 HEAD `38368f7e4b1040fd57d4647c257e34d143c0847d`。本次仅文件读取与 own metadata；没有 import、类型检查、测试、HTTP、PG、PTY、浏览器、provider 或安装。

## 现有文件与依赖

[入口静态记录](journey-entry-static.json)按实际 `journey.test.ts` → fixture → production createServer/runRunner 和 PTY `main.tsx` 的本地 import/type/re-export 检查：218 源、27 个实际读 SQL 均存在并与固定提交逐字一致，没有未解析本地相对路径。两组动态模板数组明确展开 012/013 与 017/019；001/003 是原有内联迁移。旧准备清单第28个 SQL `030-goal-progression.sql` 已存在，但本固定 factory/fixture 不调用其迁移；不把全目录存在当运行闭包证据。

Python PTY脚本、Vitest配置与CLI文件存在；Node24和 `/usr/bin/python3` 路径及可执行权限已核，未调用它们。14个第三方 manifest/公开入口的字节、版本和 donor 路径均与既有提议相同；4个 workspace alias 均指本候选源码，不指 moving main。Lead创建的9第三方+1 own alias 原回执已[原样归档](journey-runtime-view-receipt.json)，SHA `983e13b9448f85b225104c94b985719468cb3ca45f35f5302648df3466def4ab`。

结论为 **NO_DEFINITE_STATIC_ENTRY_MISSING**。没有新的确定缺件需补源；文件存在和入口hash不证明全部传递依赖运行解析、Node动态加载、PG可达或PTY行为。实际 runtime/03 继续 **NOT_RUN**。此前静态独审范围不扩大。

## 唯一后续入口（当前不得执行）

在本权威 worktree cwd，调度者先分配新窗口，并确认下面绝对证据目录不存在；如已存在只能在准入前选择新的空路径，不能覆盖或重跑原 reservation。不读取或打印连接凭据；沿 fixture 既有本机 PG 规则。

```sh
FLOW_TUI01F_EVIDENCE_DIR=/tmp/flow-tui01f-03-approved-window-1 PATH=/opt/homebrew/opt/node@24/bin:/usr/bin:/bin /opt/homebrew/opt/node@24/bin/node node_modules/vitest/vitest.mjs run apps/tui/src/task-controls/journey.test.ts --no-cache --configLoader runner --maxWorkers 1
```

预期**仅2项**、同一生命周期，必须完整顺序运行该文件，不能只选第二项。现有 Vitest4 CLI 的 cache/configLoader 声明静态确认；本轮未执行帮助命令或解析 import。30秒 test/hook 设置来自固定配置，第二项显式30秒；这不是整个旅程的硬总期限。

工作上限是一个随机 `flow_tui01f_*` 数据库、一个 production factory、一个 fixture runner、一个 conversation、A/B/C三轮、两个不同cancel和A一次原key恢复（最多3 cancel POST）。0 SDK/provider，0实际App。第一项是两个公开客户端和durable journal丢ACK；第二项由Python真实PTY运行Ink、取消B，CJK/emoji多行草稿与60×20 resize后退出，C继续运行。headless证据不替代PTY，PTY不替代浏览器。

## 资源与清理界限

现有源码限制：proxy每请求16KiB/响应512KiB；PTY原始文本128KiB、子进程总输出2MiB；每个JSON证据文件2MiB。**这些不是整场磁盘/内存峰值或所有输出总和2MiB的保证**。原建议 fresh ≥1GiB共享保留量+32MiB仅候选门槛，尚无实际PG增量测量，也不自动获得运行许可；后续调度需另定实际预算/检查空间。禁止新安装、full build或借用个人服务。

单次PTY等待26秒；自有PGID停止为TERM3秒→KILL1秒并检查整个组，leader退出不等组停止，仅ESRCH视为消失。runner/HTTP/center各有有界等待；等待超时不证明操作已终止。停止自有资源并收集状态后，完整checkpoint必须成功持久写入，才能DROP自己数据库/rm自己tmp；unknown或checkpoint失败保留数据库/tmp，不盲清理。原始失败与reservation保留。不能将此准备写为清理成功、原生取消已证或完整TUI→Web→TUI通过。

## 记录绑定

- `journey-runtime-view-receipt.json`：4578 B，SHA256 `983e13b9448f85b225104c94b985719468cb3ca45f35f5302648df3466def4ab`。
- `journey-entry-claim-observation.json`：1210 B，SHA256 `86d0f27f389eeba3380cac2718e55d50e1114e0fa086cf70a8fe071ad800b7bc`。
- `journey-entry-static.json`：86737 B，SHA256 `4443ded0245fc5814f542baa64cd69ff606d039794f7e4c51b566b26ae13241b`。

[fresh claim](journey-entry-claim-observation.json)确认TUI01F v1仍属本owner；仅写原plan/evidence。2026-10-06 17:02 UTC clean-code复核：维持一个既有fixture生命周期与一个运行入口，不新增resolver/manifest平台/状态机；metadata表述把静态文件可用、类型批准和实际行为分开。产品源码与原raw不改。
