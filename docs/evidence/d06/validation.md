# D06 固定候选验证

初稿实现target `d5a87b851e3d5a820585180cb4efa47b6148632a`，base/策展源码 `8f1481df880cf5077e1ddb9a8f302fe700a7ece8`。Node24.20.0 / pnpm9.15.4 / Chrome154.0.8037.98。全部检查在提交前相同源码完成；随后只提交，源码无改动，不声称在固定commit后重新运行。

## 依据与事实

- [中心挂载](https://github.com/CM-BF/Flow/blob/8f1481df880cf5077e1ddb9a8f302fe700a7ece8/apps/server/src/index.ts)：goals/conversations/plugins/assistant均有迁移和鉴权route挂载；Pool8，pg-boss独立3。
- [会话命令](https://github.com/CM-BF/Flow/blob/8f1481df880cf5077e1ddb9a8f302fe700a7ece8/apps/server/src/conversations/commands.ts)：conversation/ordered turn/task持久关系；SDK session另有runner互斥。8f App无ConversationThread，后继7cb分支不注入本基线。
- [assistant存取](https://github.com/CM-BF/Flow/blob/8f1481df880cf5077e1ddb9a8f302fe700a7ece8/apps/server/src/assistant/store.ts)：session/source ID/digest/settings、PG details正文、读时digest校验；与events的usage/verification/completed各分路。
- [事件](https://github.com/CM-BF/Flow/blob/8f1481df880cf5077e1ddb9a8f302fe700a7ece8/apps/server/src/events.ts)、[租约](https://github.com/CM-BF/Flow/blob/8f1481df880cf5077e1ddb9a8f302fe700a7ece8/apps/server/src/runners.ts)、[C02](https://github.com/CM-BF/Flow/blob/8f1481df880cf5077e1ddb9a8f302fe700a7ece8/apps/server/src/reconciliation.ts)：三活动态completed结果/uncertain；resolve后retry新task而非原task复活。
- [PG evidence](https://github.com/CM-BF/Flow/blob/8f1481df880cf5077e1ddb9a8f302fe700a7ece8/apps/server/src/evidence.ts)：saveDetail/artifact实际PG text，没有运行blob adapter。
- [PG plugin registry](https://github.com/CM-BF/Flow/blob/8f1481df880cf5077e1ddb9a8f302fe700a7ece8/apps/server/src/plugins/index.ts)与[可信Web挂载](https://github.com/CM-BF/Flow/blob/8f1481df880cf5077e1ddb9a8f302fe700a7ece8/apps/web/src/plugin-integration/session.ts)分开：后者本地启停不是npm安装/中心授权/第三方隔离。

## 实际检查

`node --test apps/execution-dashboard/test/architecture.test.mjs`：5/5，固定source全部存在/节点边合法、HTTP只读Host/CSP边界、已实现与后继区分、FSM三活动态/不复活、PG内容与blob隔离。[原输出](node-tests.txt)。仅修改本测试，不跑产品全套/PG实验。

`node docs/evidence/d06/browser-check.mjs http://127.0.0.1:55247/`：实际5视图切换/节点box文本边界/Enter选择/固定SHA链接、浅深主题、390px无页面水平溢出、reduced-motion环境、zoom控件、0pageerrors。[原报告](browser-checks.json)。独立loopback preview由本owner启动；未改4320。浏览器只读真实status，未启用工程claim写入或模型。

已目视：[模块浅色](modules-light.png)、[状态浅色](states-light.png)、[状态深色](states-dark.png)、[数据深色](data-dark.png)、[390深色](data-dark-narrow.png)、[390浅色](data-light-narrow.png)。窄屏画布仍允许水平滚动，语义详情在图后；不宣称所有图无需滚动或做过屏读验收。

## 范围与限制

两个实现文件全落v1 claim四scope；rootmanifest/lock、registry、renderer、CSS均diff0。恢复本地预览：Node24执行`node docs/evidence/d06/preview.mjs`，动态URL以stdout为准，当前55247/PID42719仅本owner服务。原产品49922/55049/63743与工程4320保持。未测Safari/Firefox/屏读、真实吞吐/模型、未部署main，图不是实时拓扑。无新增依赖，offline frozen安装只建ignored node_modules。

## 来源P3窄修与最终审查

最终target `ef42277ff55d1cbb76ea707836481a9788619033`。Root指出R04/P03实际登记源在固定registry而非full-plan-matrix；ef只改nextbackend.source，完整X01父范围仍见固定full-plan-matrix REQ11–13。重新5Node通过及[局部href报告](source-review-check.json)，不重跑无变化全浏览器或六图。Root独立CUA确认准确href并APPROVED；w01独立d5语义/5tests与root审图结果如[review](../../../plans/d06-architecture-refresh/review.md)，检查来源不混写。

04:28实际集成：origin/main=4e0289f29ffa48c6c49003837d4520f57c22b6b0，git merge-base --is-ancestor ef42277 origin/main exit0，两声明实现文件diff0；[4320 snapshot与静态图核验](dashboard-observation.json)47源、D06唯一live/claim匹配/checks+review ef/proof unchanged/issues[]，main current/scopeEqual。GET4320 architecture-data.js包含固定8f与修正registry链接。没有重启服务或用approval推定部署。原前文未部署是提交时历史，本次明确新增实际证据。
