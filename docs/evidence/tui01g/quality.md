# TUI01G 结构/源码安全点

2026-10-06 23:29:08 UTC，source 215063fb4667fc394a07417d608b075fa1188d92。find-skills 本地结果与 SHA 见 skills.json。复用 public schema/checkClaudeTurnSettingsAllowed/assertClaudeTurnSettingsMatch、既有 ACK decoder 和 IntentStore；未新增通信/恢复/授权状态机。settings Module 集中 capability/profile 关联、完整 tuple 选择与 final observation 来源判断，controller 只持观察与下一消息选择，Ink/headless 共同调用 typed commands。

命名与职责检查：目录每页 6 profiles，每项最多 32 choices，显示每页 8 choices；无目录累计缓存/自动抓取；观察结果由原 epoch/AbortSignal 丢弃；profile access 只读，无任意字段组合；unknown 原请求持久不变。新 requested/observed 显示与 legacy effective model 行区分，Observed 仅匹配 final wrapper 的 SDK init；不存在 thinking 证明。

源码自查完成、git diff --check 0。12 新用例目前仅源码，types/behavior NOT_RUN（资源低于原门槛）；未安装或运行模型/PG/PTY/HTTP。不把静态检查称功能已通过。旧直接消费者读取，后续只跑实际受影响范围。F04 固定输入与原失败不变。

2026-10-07 02:17:40 UTC：局部验证安全点复核 clean-code/codebase-design：原 12 产品文件零修改，修正测试加载身份而不改业务绕过失败；使用既有 OPS14 监督接口，primary failure 与资源事实分开。51 不同用例分轮覆盖选择、缺能力、冻结/恢复、矛盾 ACK、旧 intent/CAS 与真实 Ink。原失败保留，private cache 正常清理，未新增状态机/权限/传输层。独立行为核验仍待审。
