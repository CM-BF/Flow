# WPF-P01 可信 Web 插件 host（X01 Web 子项）

唯一 owner：w01_owner；co-lead：external_web_d01_owner。当前树 `web-plugin-diagnostics` / `codex/web-plugin-diagnostics`。原任务迁移，未创建同义任务。[来源切换](../../docs/evidence/wpf-p01/diagnostic-notification/source-switch.json)。

原 6ce3ba0 实现/历史交付保留于 [原计划](../../docs/evidence/wpf-p01/diagnostic-notification/prior-plan.md)、[原状态](../../docs/evidence/wpf-p01/diagnostic-notification/prior-status.md)、[原审查](../../docs/evidence/wpf-p01/diagnostic-notification/prior-review.md)。大证据仍由原 web-plugin-host 树保存，原树冻结。

- [x] WPF-P01-01 原接口与唯一 owner 已确认（历史）。
- [x] WPF-P01-02 原 trusted host 已交付（历史）。
- [x] WPF-P01-03 原限定隔离验证已完成（历史）。
- [ ] WPF-P01-04 X01 全栈剩余验收由原父计划继续维护，不因本修复虚勾。
- [ ] PLUGIN-DIAGNOSTIC-NOTIFY-01 诊断变化即时通知已打开的生产 Settings；源码与定向局部已固定，真实挂载尚未运行。
  - [x] 专用稳定订阅/100项快照/错误隔离/解绑及 dispose，保持原 global/slot 状态。
  - [x] 六个定向行为分轮覆盖及 affected strict0；首轮失败原件保留，不冒同轮6/6。
  - [x] 集中独立源码/局部结果审查（root 10588c，限定批准）。
  - [ ] 真实 AppPluginSession/PluginProvider/PluginSettings 挂载聚焦验收；独立 owned caller/输入闭包/新窗口待供给。
  - [ ] 主线接收及现有 D05 WPF-P01 来源替换/实际 live核验。

本次精确范围见 claim；只改 host、生产 plugin-integration/react、对应 host test、真实 session/provider slot-fixture 与原 integration browser 聚焦入口，以及本计划/证据。App/Thread/Picker 与公共契约不改。未授权浏览器/HTTP/PG。

本轮 [固定源码与局部证据](../../docs/evidence/wpf-p01/diagnostic-notification/review-input.json)：五源目标 `b7dd3add045bc3b3daa3f2ffdb21cb2cb9b4b01a`；四child 5759/60000ms CLOSED，未使用时间不是新许可。两产品自8ad422后未变；a78仅纠正源订阅测试声明，b7dd仅稳定真实Settings夹具的激活前置。纯检查不代浏览器、主线或完整X01验收。
