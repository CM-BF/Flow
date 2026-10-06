# CHAT09 配置绑定的执行中指令受理

固定实现/Review target：`cd8594be137ee165f2745265842fc3678c5dfb46`；base `9c6fa9b100f04916f43b04280f05f497b28eeb0f`；首合同 `042192732831a7f921d474a37870d688f9dc6716`。单一owner runner_owner / gpt-6-astra。assignment_review 独立只读 APPROVED，范围见[正式review](../../../plans/chat09-steering-admission/review.md)；未重跑检查，本分支仍待main receipt。完整范围/hash见[manifest](manifest.json)，接口见[interface](interface.md)。

显式manifest开关经过同一次解析参与profile发布与runtime启动。只有新配置的固定protocol写入digest；false/缺省仍保留旧canonical bytes。新配置不支持planner tools，不能以旧runner identity变更。adapter前检查当前pin/digest/port；未pin旧任务移除steering port并继续原string query。旧adapter-only loader拒绝丢弃开启配置，调用者须使用完整configuration入口。

中心在现有runner→task→attempt锁后、幂等重放前检查当前task pin、profile、attempt.runnerId及既有lease/session。无pin、旧配置、未知协议、过期身份/错误digest拒绝且不写命令。已有CHAT08控制/结果/final事务不变。没有新增migration或agent loop。

目录只在精确一次header opt-in返回新旧配置；旧/未知/duplicate/comma响应先在SQL过滤新配置再分页，no-store。header不是权限。public controls.steer与conversation capability仍false。旧center拒绝/不确认publication时实际启动进程退出、不开始claim，未实现静默降级。

## 实际检查

| 原始输出 | 实际结果 | 范围/计数 |
| --- | --- | --- |
| configuration-red.txt | 1 red / 9未选 | 原manifest不识别开关 |
| configuration-green.txt | 10/10 | 第一配置片段 |
| admission-red.txt | 1 red | 旧string配置错误返回202而非409 |
| admission-green.txt | 1/1 | 修复后拒绝且无部分持久事实 |
| admission-behavior.txt | 6/6 | 真实随机PG/HTTP，目录/受理/重启 |
| consumers-first.txt | 55/55，12.99s | 配置10+runner profile10+新PG6+原steering16+finalization13 |
| legacy-input-final.txt | 21/21，2.63s | 新PG增1至7，manifest增4至14；增加5个distinct，其余重复 |
| legacy-profile-consumer.txt | 7/7，3.96s | 旧profile直接消费者，改用独占随机库，保留全部断言 |
| web-profile-consumer.txt | 21/21 | 既有Web目录/选择纯逻辑与HTTP消费者，只读运行、未改文件 |
| legacy-loader-red.txt | 1 red / 14未选 | adapter-only入口静默丢弃新配置 |
| legacy-loader-green.txt | 1/1 / 14未选 | 明确拒绝；增加1个distinct |
| typecheck-first.txt / typecheck-final.txt / typecheck-delivery.txt | exit0 | 最后文件覆盖最终target |
| cleanup.txt | flow_chat09_专库remaining=[] | 只读收尾确认；测试期间CREATE/DROP自己的随机DB |
| install.txt | exit0 | frozen lock、ignore-scripts；未改共享依赖 |

共 **89 distinct passing behaviors**：配置15 + runner profile10 + 新PG7 + 旧profile7 + 原steering16 + finalization13 + Web21。没有把55+21重复运行当76个独立行为，也没有声称14未选项在最后一次都重跑。未重跑CHAT08全106项。

真实生产factory启动在随机数据库/动态端口；默认关闭通过新PG测试启用/关闭/重启验。既有steering fixture增加hasRoute以兼容已挂载生产factory；仅调整explicit profile绑定和setup，保留全部行为断言。最终13项含实际runRunner→profile guard→注入SDK多result→durable outbox→PG；新PG还证明同能力runner执行未pin旧任务时实际SDK seam收到string且无steering control行。

复跑公开入口（不默认重跑）：
```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec vitest run apps/runner/src/configuration.test.ts apps/runner/src/execution-profiles.test.ts apps/server/src/execution-profiles apps/server/src/active-steering apps/web/test/execution-profiles.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm typecheck
```

## 限制

0真实provider/query，不读取实际provider凭据，不碰个人服务/共享DB。SDK帧均注入，配置声明不是provider在线/UUID/pending支持证明；未知沿CHAT08保守处理。无UI按钮/cap开启、无真实native进程/模型遵从验收。新目录版本的薄client由F01单独交付；旧Web只读消费者通过不等新UI已接。claim保持待独审/修复，架构影响由Lead在集成时更新固定图。
