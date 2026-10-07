# 活动视图累计缓存：原验收覆盖补充

固定源码输入：`d0573c7dcf6b051a007b44e84cba4ff74fda247d`。本片仅补管理文档，尚待[独立文档审查](review.md)；产品实现、容量数值选择、运行检查和性能测量均未开展。

## 覆盖结论

原 [WPF-MATURE-05-05](../../../../plans/wpf-mature-05-workspace/plan.md) 已要求 DOM、缓存、订阅有界及受保护草稿生命周期，但没有长时活动 view 累计读取的分项上限与淘汰后可达性验收。原 [WPF-MATURE-06-03](../../../../plans/wpf-mature-06-chat/plan.md) 已有活动呈现与懒详情，未明确该层的累计正文、metadata 和并发边界。本次只补这两个已有 TODO，不增加任务、writer 或运行预约；05 主责 view 聚合与生命周期，06 主责内容可达与重读。

## 固定源码事实

来源为 root 本轮只读核验；管理者复算[七个给定源码 SHA 与三个 UI/registry 身份](source-pins.json)，均来自固定 Git 对象，未导入产品。

| 范围 | 已有行为 | 尚不能据此证明的界限 |
| --- | --- | --- |
| Native activity projection | refresh 保存 `pages[index]`，showPage 不淘汰；正文成功或错误记录在 bodies 中累积。隐藏时 invalidate 取消读取并改 loading，保留已有数据。 | 每页20条、单 body 64KiB 不能限制长时 view 的所有 pages/bodies。 |
| Generic activity projection | read 合并 Map entries，details 累积；普通 refresh/read 不清 details，明确 page.reset 或 dispose 才清空。 | 单 detail 1MiB 与本地显示分页不等于累计 entries/details 总量上限。不可把 native 的64KiB套到此处。 |
| P01 activity binding | 按完整身份保存每 turn 的 native 与 generic projection；turn 移出 sync 或 dispose 才删除。 | view 数量有界不能证明仍活动 pane 内所有 turn 的 metadata、body 或 in-flight 总界限。 |
| 并发读取 | bodyFlights/detailFlights 按 ID 去重，生命周期有 abort。 | 去重不是跨 turn 总配额；当前 displayed page 的读取约束不是整个 pane 总限流。 |
| 现有 ReadCache | 支持 entries、正文 UTF-8 bytes、touch/retain/clear，固定 main 与原交付10ca字节相同。 | 未接入这些 activity projection，且不包含 metadata byte 计量、flight 限流或页 cursor 恢复；不能直接宣称套用即可解决全部条件。 |

Native UI 用 pages[index] 及相邻 index 做前后导航；generic UI 把累计 entries 按25行显示，正文按8192字符分页但仍保完整 response。未来回收 metadata 必须同时保稳定 cursor/起点的显式回读和展开、焦点重建；既不能直接 splice 导致旧页失联，也不能为可达性永久留下无限索引。

root 对 native 9 项测试全文与 generic/integration 相关测试的只读检查发现：既有缓存命中、当前页刷新、identity/UTF-8、late hide/abort、稀疏 cursor/reset 等覆盖，没有该聚合淘汰验收。这不是一次测试运行。root 定向比较 Recovery 000a、Quick60ffa、native-body720d 的相关四路径未发现候选独有修改；activity-window/integration 已为 main 祖先，不能把旧 ReadCache 交付当作待合修复。

## 共同验收输入

1. 以同一长期活动 view 的多 turn、多次展开和分页累计读取为对象，明确 metadata entries/bytes、body entries/UTF-8 bytes、in-flight 的计量归属、聚合上限与超额策略。metadata 包括页/游标/错误缓存等持久保留索引；嵌套单项上限不能替代总量。先评估现有 ReadCache 与生命周期接缝，数值与实现由后续合法 owner 固定，不默认预取或新框架。
2. 淘汰只影响可重建的读取缓存；保留稳定身份和有界导航材料，内容可通过显式操作重新读取，前后 cursor/起点可达。展开/焦点能恢复到当前仍合法的控件，hidden、失权或旧 identity 不抢焦点；不能为了可达性保留无限 metadata。
3. 展开前零正文 GET。多次展开/分页与错误/重试均进入同一计量口径；去重、取消、late completion 不得绕过总量和 in-flight 上限。实际请求计数与 cache 命中分开记录。
4. connection/view/turn/task 身份隔离及换代清理保持；unknown、未发草稿/附件、未决回执和后台执行语义不变，回收缓存不 cancel 后台任务、不静默丢保护材料。
5. 用有界0模型场景分别核累计计量、淘汰/显式重读、稀疏 cursor 与焦点恢复。源码缺少显式界限不等于已测 heap 泄漏、增长或卡顿；没有运行数据时不报告收益或性能失败。

## 权威与排程

唯一功能进度仍在 [05 status](../../../../plans/wpf-mature-05-workspace/status.md) 与 [06 status](../../../../plans/wpf-mature-06-chat/status.md)，完整大task review 保持 NOT_STARTED / target UNKNOWN。本目录是共享证据与独立文档审查入口，不是第二功能状态源。

固定 main 的 registry.mjs 第83/84行仍映射上述两份管理树 status；本次只核静态映射，不采4320、不运行聚合器。管理 claim632a7149 v3/exact6 的[本轮 fresh 观察](claim-observation.json)有效，无冲突；未新 take/amend/release。Recovery/Quick 关键路径与既有队列保持，实施前另核合法产品范围。

root 本次入站提供 free888332KiB、未达原门槛；原采样时间未提供，本组没有资源采样。该信息不构成工程测试、浏览器或 CI 准入，本次无 grant、运行或预约。
