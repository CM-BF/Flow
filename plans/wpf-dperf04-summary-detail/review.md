# WPF-DPERF04 独立审查

**状态：CHANGES_REQUESTED**

Review target commit：4facd052c25e63ea300f72ea46c03c51fb983980

Base：c837b5dccaea429b0112d1c7e0c752c41334204a

固定4fac独立源码审查为CHANGES_REQUESTED，尚无运行结果。[root原样报告](../../docs/evidence/wpf-dperf04/review-4fac/root.json)、[workspace_panels_owner报告](../../docs/evidence/wpf-dperf04/review-4fac/client.md)与[固定来源](../../docs/evidence/wpf-dperf04/review-4fac/client-sources.json)。

4fac的三个P2：领取scope原文被Markdown格式清洗；自动摘要刷新销毁已开文档/焦点；迟到响应专测未等真实投递及正文结算。root对三个服务端模块未发现新增blocking；这不是整体批准或运行通过。后继修复须绑定新target再复审，保留4fac历史。

后继候选 `6c18b81a11eece9c07dd047d28da099a0b6bbb24` 已完成对应源修复，仅app/browser两文件，尚待独立delta复审及实际行为检查；本记录不提前关闭finding。

root对6c18补充源码finding：未登记claim每次刷新仍重建阅读节点；scope原文/绝对deadline源修正确认。后继 `b0e937d53a664b3398d36a080cef1a2d4225b6f3` 修复此同类P2并增加100 scope/unknown/版本变更回归。当前仍为修复待复审，未取得运行证据。

root授权日期专测维护固定 `1441d86baa40e98f4cb81b82dcc551202973209b`：只有summary-detail.test.mjs变化，b0e app/browser原字节保持；首次行为检查仍NOT_RUN，不以此维护commit改变既有审查结论。

## 2026-10-06 16:57:00 UTC 首Node失败后的测试修复待审

后继 `abd2aff768f97350762b2eaddbe7ae6843902f48` 只改direct Host用例，source manifest已重绑；原独审CHANGES_REQUESTED历史和新UI源码复审来源不变。请求审查node:http实际Host构造、服务端入站证据、403不变、timeout/监听清理。未执行新Node/浏览器或空间采样，原1441单次1632ms失败保留。
