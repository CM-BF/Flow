# R06 技能与工作段质量

2026-10-06 09:04:58 UTC，范围：Node24 TypeScript stdio transport/生命周期设计。

先依 find-skills 本地优先方法，实际读取 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、`codebase-design/SKILL.md`、`clean-code/SKILL.md`，以及 tdd 的 SKILL/tests/mocking、brainstorming。已有本地深模块/错误边界/行为测试方法满足此范围，无缺失专用技能，不装依赖或技能。clean-code 固定 sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。

应用：单一 transport 生命周期所有权，小组合端口，帧解码/写队列隐藏；测试仅公开 API→实际自有合成 Node stdio。已有授权与精确派工明确该 seam，按项目规则继续，不重新请求普通设计许可。先 tracer 行为 red/green 后补边界，不用模块缺失冒行为red。检查命名、错误清洗、无不必要框架、有限资源；首合同没有已执行检查。

2026-10-06 09:13:41 UTC，交付前 clean-code：检查全部 7 authored source（含公开测试/合成 peer），state ownership 在 transport，一份 write/decoder 边界，无模型类型分支或第二 loop。发现并修复：JSON.stringify 会静默丢 undefined/NaN，改有界显式数据编码（保留 red）；timeout/abort 后删除 promise 不能释放仍未知远端请求的并发额度，新增 bounded reservation（保留 red/late release）。decoder 改固定 buffer，避免一字节碎片堆积独立 Buffer 引用。命名、错误清洗、生命周期释放、raw stderr 禁存、依赖方向均复核。未解决项是计划所列真实 Codex/后继 adapter 能力，并非本片测试豁免。

中间 2+2 个红断言：第一组是 synthetic peer 非原子逐字节帧与 delayed response 交错，以及关闭 stdin 导致忽略 TERM 的 peer 自然退出；第二组是暂停输入的 peer 无活动 handle 自然退出，以及 macOS 系统自动追加环境元字段。修 fixture 保持实际被测边界，未删断言或把错误协议容忍为成功。
