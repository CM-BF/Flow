# WPF-P01 可信 Web 插件 host（X01 Web 子项）

唯一 owner：w01_owner；co-lead：external_web_d01_owner。当前树 `web-plugin-diagnostics` / `codex/web-plugin-diagnostics`。原任务迁移，未创建同义任务。[来源切换](../../docs/evidence/wpf-p01/diagnostic-notification/source-switch.json)。

原 6ce3ba0 实现/历史交付保留于 [原计划](../../docs/evidence/wpf-p01/diagnostic-notification/prior-plan.md)、[原状态](../../docs/evidence/wpf-p01/diagnostic-notification/prior-status.md)、[原审查](../../docs/evidence/wpf-p01/diagnostic-notification/prior-review.md)。大证据仍由原 web-plugin-host 树保存，原树冻结。

- [x] WPF-P01-01 原接口与唯一 owner 已确认（历史）。
- [x] WPF-P01-02 原 trusted host 已交付（历史）。
- [x] WPF-P01-03 原限定隔离验证已完成（历史）。
- [ ] WPF-P01-04 X01 全栈剩余验收由原父计划继续维护，不因本修复虚勾。
- [ ] PLUGIN-DIAGNOSTIC-NOTIFY-01 诊断变化即时通知已打开的生产 Settings；保同一100项快照、稳定订阅、错误隔离、解绑/dispose，避免重建global/slot状态。纯检查与真实挂载验收分列。

本次精确范围见 claim；只改 host、生产 plugin-integration/react、对应 host test、真实 session/provider slot-fixture 与原 integration browser 聚焦入口，以及本计划/证据。App/Thread/Picker 与公共契约不改。未授权浏览器/HTTP/PG。
