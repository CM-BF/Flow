# WPF-DPERF04 独立审查

**状态：UNKNOWN（部分审查已完成；全片浏览器验收待完成）**

Review target commit：b17bb05c797cfccc8dbeb4c3de26e57143600bec

Base：c837b5dccaea429b0112d1c7e0c752c41334204a

原abd2产品与直接检查源码复审已完成且无剩余blocking；当前b17仅browser监督入口新增，尚待独立source review；作者第二次Node7叶项+父项8/8实际通过，root已独立核原raw/cleanup。浏览器尚未运行，完整片段与main/生产验收未完成；UNKNOWN由现有parser准确表达部分结论，不改parser或冒整体APPROVED。

## 已执行独审链与限定

- root最初4fac三server模块无新增blocking，client三个P2原报告保留；6c18后继源修由root/peer限定复核，未登记claim同类P2继续由b0修。
- [panels b0e client复审](../../docs/evidence/wpf-dperf04/review-current/b0e937-client/report.md)与[fixed来源](../../docs/evidence/wpf-dperf04/review-current/b0e937-client/sources.json)：C1-U已在固定源处理，C2因果投递块未回归，0blocking；不是浏览器实跑。
- [root1441日期专测复审](../../docs/evidence/wpf-dperf04/review-current/dperf04-1441-date-root-review.json)：仅日期依赖修正，确认前述source chain无剩余blocking。
- [root abd2 Host复审](../../docs/evidence/wpf-dperf04/review-current/dperf04-abd2-host-root-review.json)与[panels复审](../../docs/evidence/wpf-dperf04/review-current/dperf04-abd2-host-peer-review.md)：0blocking，仅真实Host transport与入站断言delta；原server防护未改。
- [root第二Node实际证据核验](../../docs/evidence/wpf-dperf04/review-current/dperf04-node-second-root-review.json)：原四raw逐字相同/8PASS/2318ms/累计3950ms/cleanup确认；root没有重跑Node。浏览器动态焦点/选区/迟到响应、390双主题与生产延迟均未验。

本次归档来源均为原独立reviewer报告，无作者替代批准。当前browser监督入口已固定b17；私有父监督稿更新Playwright digest字段，二者需独立source review及未来fresh运行gate。没有提前执行或整体批准。

## 历史审查与当时状态（以下不代表当前待复审）

固定4fac独立源码审查为CHANGES_REQUESTED，尚无运行结果。[root原样报告](../../docs/evidence/wpf-dperf04/review-4fac/root.json)、[workspace_panels_owner报告](../../docs/evidence/wpf-dperf04/review-4fac/client.md)与[固定来源](../../docs/evidence/wpf-dperf04/review-4fac/client-sources.json)。

4fac的三个P2：领取scope原文被Markdown格式清洗；自动摘要刷新销毁已开文档/焦点；迟到响应专测未等真实投递及正文结算。root对三个服务端模块未发现新增blocking；这不是整体批准或运行通过。后继修复须绑定新target再复审，保留4fac历史。

后继候选 `6c18b81a11eece9c07dd047d28da099a0b6bbb24` 已完成对应源修复，仅app/browser两文件，尚待独立delta复审及实际行为检查；本记录不提前关闭finding。

root对6c18补充源码finding：未登记claim每次刷新仍重建阅读节点；scope原文/绝对deadline源修正确认。后继 `b0e937d53a664b3398d36a080cef1a2d4225b6f3` 修复此同类P2并增加100 scope/unknown/版本变更回归。当前仍为修复待复审，未取得运行证据。

root授权日期专测维护固定 `1441d86baa40e98f4cb81b82dcc551202973209b`：只有summary-detail.test.mjs变化，b0e app/browser原字节保持；首次行为检查仍NOT_RUN，不以此维护commit改变既有审查结论。

## 2026-10-06 16:57:00 UTC 首Node失败后的测试修复待审

后继 `abd2aff768f97350762b2eaddbe7ae6843902f48` 只改direct Host用例，source manifest已重绑；原独审CHANGES_REQUESTED历史和新UI源码复审来源不变。请求审查node:http实际Host构造、服务端入站证据、403不变、timeout/监听清理。未执行新Node/浏览器或空间采样，原1441单次1632ms失败保留。

## 2026-10-06 16:59:01 UTC 作者直接验证结果（非独审结论）

固定abd2 / 实际823071的第二次受控Node 7叶项+父项8/8、exit0，监督2318ms，cleanup完整；[原raw](../../docs/evidence/wpf-dperf04/node-second/result.json)。首1441失败保留；browser尚未运行，独审不得由作者测试代替。

## 2026-10-06 17:31:00 UTC 新监督入口待限定源码审查

见[接口和来源](../../docs/evidence/wpf-dperf04/browser-wrapper-source/interface.md)。原行为断言字节不变，只有生命周期/门禁变化；root原结构接受不替代本次固定实现审查。所有新runtime未执行，UNKNOWN保持。
