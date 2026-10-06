# WPF-RELEASE03 当前前端发布兼容验证

状态：in-progress。创建/更新：2026-10-06 14:40:27 UTC。直接父任务 WPF-MATURE-01；owner w01_owner / gpt-6-astra / ultra。遵循[模块与性能规则](../../AGENTS.md#modular-design)。

## 目标与固定输入

验证已审新前端与个人后台所用固定版本能否安全组合，为原 SVC operator 提供可核对的正式产物与真实兼容证据；本片不发布、不操作个人服务。后端、client、contracts 固定 `362af3bac77541e5a60979326bcf4d4b8c947915`；前端正式 format2 产物 d629，sourceHead5069586、获审生产来源9eec，releaseId388371a4972c469b8ace623454594132，详见[产物输入](../../docs/evidence/wpf-release03/artifact-input.json)。不重构建或重装，不追 moving main。

## 两模块和资源边界

- fixture：实际 createServer、单随机专库、公开 FlowClient 原生事件模拟、精确静态字节 HTTP host、透传代理和幂等清理；不复制 server/decoder/发布框架。
- browser：先 attachment-only/mixed context_observation，后真实 App v1/v2 Send、原键丢 ACK 恢复、Queue、新草稿和协商；根据实际结果生成原 SVC 四 observation，不硬填通过。
- 当前仅源码授权：依赖链接、PG、Chrome、任何兼容运行须独立资源及合法 scope 门槛。未来累计≤180秒（至少20秒清理）、单PG+单Chrome、证据≤8MiB、0provider。失败启动也计时并保留；任意 history/清理失败禁止生成可发布全绿 report。
- 已知362 history producer的附件来源缺口保持原样，先实际验证并报告，不导入 cde 修复、不禁用观察。source scopes 仅两新 test + 此 plan/evidence。

## TODO

- [ ] RELEASE03-01 固定输入、领取与依赖/生命周期边界可审；完成两脚本源码。
- [ ] RELEASE03-02 取得资源及依赖授权后，执行有界真实兼容矩阵并保留失败/清理事实。
- [ ] RELEASE03-03 固定候选、独立审查、正常交接；真实发布仍由原 operator 决定。

## 完成条件

全部行为必须绑定后端固定源和正式 descriptor；未知/失败不得伪作兼容。只取得源码/部分失败证据时不得勾完运行或发布。主线接收与个人实际运行分开。唯一进度见[status](status.md)，独审见[review](review.md)。
