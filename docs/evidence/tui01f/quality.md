# 技能与质量

2026-10-06 15:47 UTC：本地 find-skills/codebase-design/clean-code 已复用；本任务补读 tdd、brainstorming，设计 /tmp/flow-tui01-next-control-slice.json 已由 Lead 明确授权。小模块承接 intent schema/回执，旧单 controller 继续状态所有权。公共 controller/FlowClient seam 已明确；不重复审批。

本轮授权 source-only，禁止依赖安装及运行。因此先保存行为用例源码和实现，检查状态 NOT_RUN，不能虚构 TDD 红绿；后续获运行窗口再验证。技能不扩大范围，brainstorming 新一轮审批不适用于已批准小设计。clean-code 来源沿既有 sickn33 固定 bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5。

2026-10-06 15:55 UTC：source 工作段 clean-code 复核。新增一份 task-cancel schema/单方法端口/receipt 校验，原宿主持有所有状态；从 handler 提出小 displayedTask 选择，避免嵌套三元混入 dispatch。未复制 journal 或 FIFO/queue 状态机；旧 ack/create/send/queue/退出路径保持。检查发现并修正测试负例合并对象会意外保留有效 id 的问题，现显式构造 missing-id；这是作者静态修正，未声称 test red/green。9 个源码/说明文件已固定，21 直接输入字节未变。

未解决：运行/类型行为 NOT_RUN；真实恢复是用例设计，尚非 OS crash/PG/browser/PTY 证明。scope 中 cancel_driver/跨界面实验暂未创建，以免在缺固定运行资源时造不可验证壳。后续依赖视图由 Lead 处理，本 owner 未创建链接或安装。
