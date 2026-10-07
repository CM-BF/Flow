# WPF-MESSAGESETTINGS02 证据

当前固定实现 `fe6ece131c489c79cf531a184e4cf51209f9c4a0`（四源）。此前 `35bbe76faa2128d5c1d00711fb2be3b23d54fc4f` 独立源码审查为 REQUEST_CHANGES_SCOPED_VALIDATION_GAP：唯一 MSGQUICK-R3 要求真实后页已选配置场景；后续仅 fixture/browser 补齐并修modal背景定位，当前fe6获root APPROVED_SCOPED_SOURCE_ONLY，R3/locator闭合。三项早期问题已由 root/peer 确认为 CLOSED_SOURCE_ONLY。首次c1 strict FAILED（固定输入缺失）；direct/browser NOT_RUN。

[source manifest](source-manifest.json)、[审查](../../../plans/wpf-message-settings-quick-controls/review.md)、[Interface](interface.md)、[验证提案](validation-proposal.md)为当前入口。旧35 manifest和独审原件完整保留。后页流程源码通过同一实际 HTTP fixture 先 Apply 建立 C/A/B，再刷新、Load More 和明确 Apply；未执行即不声称行为通过。

旧 Settings01 37 direct/4 browser 没有继承。真实 App/Send/Queue/Recovery/P01 宿主仍后继，MATURE02/TODO11 未完成。

检查包终态P2仅影响准备合同；已按明确早完成边界+外层真实exit/匹配seal方案修复，并获root限定静态批准。该段为历史准备结论；首次实际c1结果见下，后续绑定由管理协调。

独立browser准备包已获root限定静态批准，见browser-preparation；真实CSS/六组场景/双组清理全部为源码准备，当前browser仍NOT_RUN。c1首次实际检查失败，browser前置尚未满足，无后续运行授权。

本次新增 [portable-check](portable-check/README.md)，固定候选 `dc67b3410c12f321d62a1565145e184b52b0ca84` / [manifest](portable-candidate-manifest.json)，现获 APPROVED_SCOPED_PORTABLE_PREPARATION_NOT_RUN / 0 blocking（[root](root-dc67-portable-preparation-review.json)、[peer](peer-dc67-portable-failure-review.md)）。候选目录/manifest的NOT_STARTED保留送审历史；已审9文件不改。只做有限语法及alias-helper静态校验；portable自身仍未运行，本机c1已失败且direct/browser未运行。远程资源/清理/启用由未来owner独立承担，本机c1/b1不改。

## 当前实际证据

[c1 首次失败](c1-first-20261007/README.md)及[root独审](c1-first-20261007/root-actual-review.json)：实际exit1/strict2，tracked但未物化输入缺失；direct 0、browser NOT_RUN。1875ms晚终态/剩28125ms，早预算原样保留；完整owned cleanup后已归还窗口。没有重试、没有公共源/依赖写。

原Lead已完成该单文件[供给](c1-first-20261007/source-provision-receipt.json)，不更改c1失败；后继剩余检查包仅静态准备，未取得新运行许可。
