# CHAT02 原生助手最终正文

编号：CHAT02。创建/更新：2026-10-06。状态：in-progress。Owner：assignment_review / gpt-6-astra。依据：FLOW-001对话主线；与CHAT01的task→turn归属协作。

首段仅成功Claude SDK final.result正文：经durable outbox和现有fenced连续事件写入，持久绑定task/attempt/session/message。保留artifact与独立verification；不把thinking/tool/subagent或telemetry拼成助手正文，不调用真实模型，不宣称stream delta、queue/steer/任意模型选择已经支持。

- [ ] CHAT02-01 固定typed final合同、归属与CHAT01读取seam。
- [ ] CHAT02-02 adapter实际final正文、来源与requested/effective设置；0模型合成SDK红绿检查。
- [ ] CHAT02-03 009持久存储/有界轻读/正文detail；真实PG/HTTP顺序/去重/fence/重启检查。
- [ ] CHAT02-04 证据、clean-code、固定交付与独立审查。
- [ ] CHAT02-05 后继增量流及获授权真实模型/产品接线语义验收，首段不冒充完成。

设计：[chat02-assistant](../../docs/architecture/chat02-assistant.md)。本scope不修改CHAT01 conversations/007、X02/008、scheduler、rootlock或共享exports/client/index。普通技术选择已授权；新共享挂载由Lead执行。
