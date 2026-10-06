# CHAT09 执行中指令的配置与受理

状态：in-progress。Owner runner_owner / gpt-6-astra。创建/更新 2026-10-06 08:01:46 UTC。基线9c6fa9b100f04916f43b04280f05f497b28eeb0f。GO已批准有界设计与PG/HTTP/注入SDK seam。

目标：只有明确配置、固定版本且当前实际任务绑定的runner可收到执行中指令。复用CHAT08输入/结果/条件final，不创建第二loop；公共controls.steer与conversation能力保持false。未知/旧能力拒绝受理，不静默queue或降级。0provider，不动个人服务/真实凭据。

manifest activeSteering默认false；开启才把固定protocol写入不可变profile digest。旧配置的canonical bytes/hash不变。main使用同一解析值发布profile并启动runtime；adapter前核pin/digest/port，旧未pin任务保持string输入。中心在现runner→task→attempt锁内、重放前核当前pin/profile/runner/session。

目录精确一次header X-Flow-Execution-Profile: steering-v1返回新旧；缺省/未知/重复/comma仅旧兼容配置。header只版本协商，不授权。SQL过滤后limit+1、UUID cursor，响应no-store；翻页同header。010的immutable JSON已够，无新migration。SDK可选UUID/pending字段实际支持仍未证，缺失沿CHAT08未知处理。

| TODO ID | 产出与验收 | Owner | 依赖 |
| --- | --- | --- | --- |
| CHAT09-01 | scope/合同/interface与旧hash兼容 | runner_owner | 已审CHAT08/main |
| CHAT09-02 | manifest→profile→runtime及adapter前gate | runner_owner | 01 |
| CHAT09-03 | 目录协商与当前attempt受理，旧/未知拒绝 | runner_owner | 01 |
| CHAT09-04 | 随机PG/HTTP及注入SDK、重启/直接消费者检查 | runner_owner | 02/03 |
| CHAT09-05 | fixed target/独审/shared接收 | runner_owner / Lead | 04 |

实际范围见[status](status.md)与领取证据。shared client/export/factory归Lead；Web消费后继。架构影响仅配置和现受理gate，Lead后续更新固定架构图。find-skills本地发现/读用codebase-design、clean-code、tdd、brainstorming；已批准bounded方案直接实施，按公开seam逐红绿验证，质量记录见证据。

2026-10-06 08:08:50 UTC：本地有界片段已完成并固定 cd8594be137ee165f2745265842fc3678c5dfb46；检查通过后进入独审，公共能力仍关闭。后续真实SDK/界面按独立预算与owner验收，不扩大本片结论。

2026-10-06 08:14:53 UTC：独立只读审查APPROVED，转integration等待main receipt；本片未覆盖真实SDK/UI，不以capfalse当整体U11完成。
