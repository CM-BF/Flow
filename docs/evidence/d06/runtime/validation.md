# D06 验证与证据边界

本轮实现 `2c3160f42784ee814d968a953d557251c81a243d`，基线 `f181d84b5fb3652d62e2a181acff442d42b3e066`。最后检查在 `1dcbc7c2db619e8b723f6847002f986458b52943` + dirty 执行；五执行文件SHA256在 [绑定](source-binding.json) 对固定target/current/原报告逐项相同。此文件是事后归档，不回填运行HEAD。

| 检查 | 实际结果 | 原证据 |
| --- | --- | --- |
| 既有依赖 | offline/frozen/ignore-scripts完成，无manifest/lock改动 | [install](install.log) |
| 首次Node | 14通过/1失败：新增node引用的MATURE03计划在固定main不存在，改真实Thread源码入口；无删断言 | [first](first-direct.log) |
| Node后续 | 15/15通过；最后3945.167ms，0skip | [direct](direct.log)、[final](final-direct.log) |
| 首次source audit | author误写SteeringWorkspace类名为ConversationSteeringBindings；核真实类后修脚本 | [first](first-source-audit.log) |
| 固定来源 | 61node来源hash、119策展源码行、020/022–025迁移在git show f181存在 | [audit](source-audit.json)、[log](final-source-audit.log) |
| 首次browser | 2026-10-06T10:14:33.300Z五图通过；当时数据/脚本hash见原报告，后续仅修一个blob说明误替换及补模块上下截图 | [first report](first-browser-checks.json)、[log](first-browser.log) |
| 最终browser | 2026-10-06T10:17:13.749Z 五视图、Enter/Space、新节点详情、浅深390/减少动画通过，pageErrors=[]；只空registry自己的/api/snapshot | [final report](browser-checks.json)、[log](final-browser.log) |
| 作者目视 | 实看runtime1280、modules下部、data浅深390；图中文字及详情可达，窄屏局部滚动保留 | [runtime](runtime-light.png)、[modules](modules-bottom-light.png)、[dark390](data-dark-narrow.png)、[light390](data-light-narrow.png) |

没有改renderer/CSS/App/产品领域/shared/依赖，没有数据库/模型/真实4320读取或服务发布。旧9c6报告仅历史不复用成本轮通过。Codex受控peer证据来自固定源码说明，不是本轮运行provider；个人SVC状态不由main推断。

实际7 Markdown/50本地链接零断；parser errors=[]、implementation.errors=[]、human完整。target后产品零diff、四claim范围无越界。完整staged diffcheck仅first-direct.log:32原始Node错误输出尾空格；五执行文件diffcheck0。原日志不清洗，metadata-check.json保留原检查结果。父D01权威source显式大task身份已只读核，见parent-authority.json；不由旧main副本推断第三层。

独立review：root10:18:41 UTC限定APPROVED固定2c3160f。15/15 Node24.20.0、2570.27ms与局部CUA/390目视另列independent-review.json，原作者browser未冒称root全量复跑。
