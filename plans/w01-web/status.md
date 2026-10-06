# W01 状态

| 字段 | 记录 |
| --- | --- |
| 最近更新 / 最近main同步核验 | 2026-10-06 02:24 UTC / 2026-10-06 02:23 UTC |
| Plan | [plan.md](plan.md) |
| 单一status owner / model | W01 owner / 派发 gpt-6-astra / ultra；运行时无独立型号查询接口 |
| Worktree | `/Users/citrine/Projects/AgentHarness/Flow-worktrees/m1-web` |
| Branch | `codex/m1-web` |
| 工作基线 / 本记录核验时HEAD | 冻结 `eacee76fa7f1b6cc46b06b57ae68458637be4a26`；新实现 `cb4a39211e264538704ba9d474eeb08fc4b2759c` |
| 工作树dirty状态 | 实现已提交；当前仅W01 metadata/证据/依赖lock patch待提交；根manifest/lock无差异 |
| 工作分支状态 | in-progress；官方Thread/shell/panels实现与owner验证完成，等待新的独立review |
| 检查状态 | PASSED；target `cb4a39211e264538704ba9d474eeb08fc4b2759c`：Web typecheck、10 HTTP tests、直接依赖client/contracts 4 tests、build、10 browser tests；公共HTTP fixture范围，细分见新验证记录 |
| 已集成main状态 / HEAD | PARTIAL；旧交付 `b04df95821a55384c55c833e94405daaf35af8ad` 是main `13703a4accef004d16fd40312dd565d390896e09`祖先（只读核验）。本次新整改尚未集成 |
| Review | [review.md](review.md)，NOT_STARTED，target `cb4a39211e264538704ba9d474eeb08fc4b2759c`；历史866c20e approval不覆盖新实现 |

## TODO状态（与plan稳定ID逐项对应）

| TODO ID | 状态 | Owner | 完成证据/检查 |
| --- | --- | --- | --- |
| W01-01 | completed | W01 owner | [技能/clean-code](../../docs/evidence/w01/skills-and-quality.md)；[官方来源/适配理由](../../docs/evidence/w01/thread-revision/provenance.md) |
| W01-02 | completed | W01 owner | 新target cb4a392；[HTTP与浏览器验证](../../docs/evidence/w01/thread-revision/validation.md)；真实中心未验证 |
| W01-03 | completed | W01 owner | 新target cb4a392；[双主题、主要状态、窄屏截图](../../docs/evidence/w01/thread-revision/validation.md) |
| W01-04 | in-progress | W01 owner | 新回归通过；等待target cb4a392独立review，未宣称用户接受视觉 |
| W01-05 | completed | W01 owner（panels独立owner提交后cherry-pick） | 官方Thread/Composer、紧凑侧栏/竖栏、split/merge、右侧tabs实现完成；组件review target46a1dbd APPROVED仅属局部，整体仍待review |

## 已完成证据与检查

- [新验证记录与截图](../../docs/evidence/w01/thread-revision/validation.md)、[完整10项浏览器报告](../../docs/evidence/w01/thread-revision/browser-results.json)、[官方来源与最少适配](../../docs/evidence/w01/thread-revision/provenance.md)、[技能与clean-code](../../docs/evidence/w01/skills-and-quality.md)。
- 实际采用官方完整Thread元素及其依赖；官方Composer负责新任务输入，FlowClient/ExternalStoreRuntime仅投影、触发与缓存。已受理任务无追加消息接口，因此隐藏composer并省去不支持的编辑/重试/附件操作。Escape不取消持久任务。
- Chat行34px、左功能栏48px；每task独立projection，split/merge只调整tab组，不拼接history。文本/backend/scenario草稿及右侧panel选项在本页保留；关闭不取消，迟到受理不重开tab、不产生ghost观察。侧栏直接订阅打开任务的权威snapshot。
- AI Elements Terminal/FileTree显示只读task文本/引用，非PTY或任意文件系统。[组件独立review](../../docs/evidence/w01/workspace-panels/review.md)绑定 `46a1dbd60aa57a464d67e5ac3d39cb2673706c36`，WP-R1已关闭；通过明确cherry-pick合入，没有并发写组件目录。
- 本地预览 `http://127.0.0.1:5174/#task=demo-decision`；fixture4317；自动测试隔离5175/4318。启动见 [README](../../apps/web/README.md)。
- Node24.20.0/pnpm9.15.4/Chrome154；根lock恢复，完整[依赖patch](../../docs/evidence/w01/dependency-lock.patch)通过 `git apply --check`；公共契约/client/根manifest均未修改。

## 阻塞 / 风险 / 未验证

- 实现无已知阻塞项，整体新target独立review尚未完成。用户没有确认接受新视觉。
- 本owner所有行为证据为模拟HTTP fixture；不证明真实中心/runner/harness、数据库持久性、真实模型、跨机恢复或artifact verifier正确。
- 真实PTY、任意filesystem、完整plugin host未实现；只提供task视图及未来扩展位置。
- JS约1.08MB（gzip约323KB），构建有超过500KB chunk提示；已记录实际体积，不作为性能预算通过。代表性低端设备性能、Safari/Firefox、屏读未测。
- 浏览器重载不保留未发送草稿/布局；token只在内存。聊天历史滚动位置在跨组重新挂载时尚未作为持久布局保证，记录和详情缓存不丢失。

## 下一步与handoff

协调者对新target cb4a392执行只读独立review，发现交owner修复。Owner仅继续metadata/证据，不扩大实现。通过后交原Execution Lead整合根lock及新实现；不合并main。后续完整插件系统由独立管理计划跟进，本轮只有稳定扩展位置。

## 需要用户决定的事项

无；当前整改和验证已授权，继续独立review与工程集成。

## Dashboard 同步

本status是W01唯一手填事实源。02:23 UTC只读请求4320/api/snapshot，确认live来源为本owner worktree、branch/HEAD/dirty正确、无parse issue。更新本记录与metadata提交后再次核验。4320为原Execution Lead维护的服务，未停止或重启。

## 历史与用户整改

旧交付b04df958已由Lead集成main，历史功能review866c20e与[旧验证](../../docs/evidence/w01/validation.md)继续保留。用户明确否定仅ExternalStoreRuntime/ThreadPrimitive的原视觉，要求官方Thread，并追加Arc式chat侧栏、Codex式竖栏/分组/右侧tabs。本记录以新target和新证据为准，历史approval不得覆盖本次修改。
