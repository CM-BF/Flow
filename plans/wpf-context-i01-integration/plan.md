# WPF-CONTEXTI01 聊天知识接入

状态：completed（本片已主线接收）。所属大 task 为 [WPF-MATURE-03](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-03-attachments/plan.md)，co-lead Web /root（执行管理 d01_owner）；既有 U11 / REQ42 是需求追溯。本片接通知识引用，不代表本地上传、拖入、@file 或 runner 文件已经支持。唯一 owner w01_owner，派发模型 gpt-6-astra / ultra。固定基线 d7e1e64e7792f4d1ad4933db042f10f266ad0cca。

## 已批准旅程

显式分页选择项目，默认为无项目；通过现 outbox 的唯一创建键准备零 turn 会话，冻结 profile 与 project。正确创建回执才取得 knowledgeContext 能力；未知回执保留原键与锁定配置。已建无项目会话保持纯文本，不追加项目。

复用 P01 唯一宿主与新增 typed composer panel。宿主私有绑定 connection/view/conversation/project，项目 metadata 和知识读取权限分开；可见性、在线、授权、插件生命周期共同限制读取。用户展开才 resolve，受保护的 CONTEXT01 模块与 CONTEXT02 helpers 只读复用。

Send 与 Queue 使用同一深冻结引用规约、有序完整 tuple ACK 守卫。同步捕获 controller 与 selected 数组代际，只在真实新本地 receipt 产生后消费一次；网络 ACK 不清新草稿或新选择，unknown 原键重试，预算拒绝不截断或丢引用。

## TODO

| TODO ID | 目标 |
| --- | --- |
| WPF-CONTEXTI01-01 | 唯一领取、接口、来源与保护范围 |
| WPF-CONTEXTI01-02 | 实际项目 / prepare / P01 / Send / Queue 接线 |
| WPF-CONTEXTI01-03 | 局部语义与真实 App HTTP fixture / 双主题 / 390 键盘 |
| WPF-CONTEXTI01-04 | 固定候选独立审查、交主线与接收记录 |

## 验收

无默认项目；无项目 / 不支持能力纯文本可用；prepare 零 turn / model；创建未知回执与 profile/project 锁定；有序引用实际发送 / 排队 / 缺失或错误 ACK unknown；新草稿与同 tuple 删除后重选代际隔离。双 split、native hidden、离线、disable、close、换中心迟到均不得越界读取。实际 App fixture 与局部模块检查分别记录，0 真实模型 / 产品数据库。

## 范围

以 [原始领取回执](../../docs/evidence/wpf-context-i01/take-receipt.json) 二十 literal 为准。禁止改 shared/client/deps、protected Context01/02、ProfilePicker、ConversationQueue、official Thread 和 stream 模块。增加路径须先 amend。

[状态](status.md) · [审查](review.md) · [质量](../../docs/evidence/wpf-context-i01/quality.md)
