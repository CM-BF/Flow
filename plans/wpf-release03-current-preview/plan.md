# WPF-RELEASE03 当前前端发布兼容验证

状态：in-progress。创建：2026-10-06 14:40:27 UTC；更新：2026-10-06 15:29:28 UTC。直接父任务 WPF-MATURE-01；owner w01_owner / gpt-6-astra / ultra。遵循[模块与性能规则](../../AGENTS.md#modular-design)。

## 目标与固定输入

验证已审新前端与个人后台所用固定版本能否安全组合，为原 SVC operator 提供可核对的正式产物与真实兼容证据；本片不发布、不操作个人服务。后端、client、contracts 固定 `362af3bac77541e5a60979326bcf4d4b8c947915`；前端正式 format2 产物 d629，sourceHead5069586、获审生产来源9eec，releaseId388371a4972c469b8ace623454594132，详见[产物输入](../../docs/evidence/wpf-release03/artifact-input.json)。不重构建或重装，不追 moving main。

## 两模块和资源边界

- fixture：实际 createServer、单随机专库、公开 FlowClient 原生事件模拟、精确静态字节 HTTP host、透传代理和幂等清理；不复制 server/decoder/发布框架。
- browser：先以独立history入口跑 attachment-only/mixed context_observation（任一失败两项raw后停止/清理，B=NOT_RUN）；A全绿且另获全矩阵准入才可进入真实 App v1/v2 Send、原键丢 ACK 恢复、Queue、新草稿和协商；根据实际结果生成原 SVC 四 observation，不硬填通过。
- 每次运行须独立资源及合法 scope 门槛；本次已授权A-only单专库HTTP运行结束，后继Chrome/重跑未授权。未来累计≤180秒（至少20秒清理）、单PG+单Chrome、证据≤8MiB、0provider。失败启动也计时并保留；任意 history/清理失败禁止生成可发布全绿 report。
- 已知362 history producer的附件来源缺口保持原样，先实际验证并报告，不导入 cde 修复、不禁用观察。source scopes 仅两新 test + 此 plan/evidence。

## TODO

- [x] RELEASE03-01 固定输入、领取与依赖/生命周期边界可审；完成两脚本源码。
- [ ] RELEASE03-02 取得资源及依赖授权后，执行有界真实兼容矩阵并保留失败/清理事实。
- [ ] RELEASE03-03 固定候选、独立审查、正常交接；真实发布仍由原 operator 决定。

## 完成条件

全部行为必须绑定后端固定源和正式 descriptor；未知/失败不得伪作兼容。只取得源码/部分失败证据时不得勾完运行或发布。主线接收与个人实际运行分开。唯一进度见[status](status.md)，独审见[review](review.md)。

## 实际阶段结果

2026-10-06 15:27 UTC唯一A-only运行两项失败、资源清理完成；累计3,874ms。B仍NOT_RUN，RELEASE03-02不能勾全。原始证据见[状态](status.md)，原后台owner最小修复及新固定输入/准入是后继条件；不在本片改server或发布。

## 2026-10-06 15:34:33 UTC 受控后端重绑

原四scope足够增显式backend tuple与真实工厂加载；候选后端由Lead独立source-onlyprovision，不由本worker复制/merge。当前dbaa88fa7a5adf1da077be7739842b6e42664c26待源码独审/实际输入与freshgate；[精确接口](../../docs/evidence/wpf-release03/backend-input-interface.md)。保留旧负兼容10raw/3,874ms，剩余176,126ms，不自行重跑旧362。

## 2026-10-06 15:47:11 UTC 条件链实现

原四scope内fixed 1a7c42ac90e73471cce1fc8e1d56f4d0e60c2098实现history→独立app gate，不将已通过A无理由重跑。historyregion与整个harnessHEAD分开；raw/digest、实际factorytuple、清理/累计预算共同门禁。完整接口与未运行边界见当前backend-input-interface，实际runtime等待源码审查后管理freshgate。

## 2026-10-06 15:53:47 UTC 独审修复

root的1a7详情DTO误用P1由fixture窄修处理，固定269103d44f153f13a2f35fadb08bf11d4f62e48d；原history真实兼容仍待运行，旧362负结果和预算不变。不修改后端/shared/raw。

## 2026-10-06 16:10:42 UTC 实际A3安全点

新af51组合单附件检查通过，混合材料被资源监督停止。累计7,983ms/180秒、余172,017ms，B NOT_RUN；数据库/进程清理完成。运行TODO仍未完成，源码269103d冻结，不重试或降低门槛。详见唯一status及原样raw。

- 2026-10-06 17:24:37 UTC：同一RELEASE03原四scope修复故障注入，headers后真实ACK正文丢失；原验收与累计账保持，候选 `ef458ff06cf7f12549b4bf3e10fc9b3e4c886ec7` 仅源审，下一B另fresh准入。
