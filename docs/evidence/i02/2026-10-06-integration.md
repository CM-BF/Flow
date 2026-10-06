# G01 / P02 / WPF-M02 实际集成

2026-10-06 03:15 UTC，Execution Lead / Astra Ultra。集成实现HEAD `1eb4196f1beecb13b7f845e680480babf1110d52`；后续仅记录与固定registry新增。skills沿用本地find-skills/codebase-design/clean-code，按实际影响局部验证，不为metadata重跑全库。

## 已审输入与范围

| 片段 | 已审实现 / reviewer | 范围 |
| --- | --- | --- |
| G01 | 6394afad2480da369adb7e6156403bfc45097dfa / Goal Owner只读 | 项目revision/CAS/graph、10项PG行为；不包含自动调度 |
| P02 | f942e5a5cbf138993dd7521792dd071a172c17e1 / Goal Owner只读 | Task-based A2A持久意图/binding/恢复/不盲重发；两初始化P2已关闭 |
| F01 | 36aeaff12000d77ebd025859f999c69612fce653 / Goal Owner只读 | 生产入口、共享contracts/client/CLI接线；不代替各模块approval |
| WPF-M02 | d47c602f3bab1fe97a9be70fd37780c2918bcfbc / 外部root | 连续工作入口与有限observer；SSE六连接饥饿P2已关闭 |
| D04 | ea8d44f7d9738cb98a1dfafd1636e2bbd7c17427 / Goal Owner、assignment_review | 已审领取与展示；后续O01/PERF两固定registry条目已核唯一status |

## 已执行的整合检查

以下是工具实际执行记录整理，不冒充新重跑或原始stdout。F01组合source8c27fed：

- `pnpm exec vitest run apps/cli/src/projects.test.ts apps/server/src/protocol-dispatch/dispatch.test.ts packages/contracts/src/harnesses.test.ts packages/client/src/client.test.ts`：10/10，4.26秒；真实PG与动态端口。
- `pnpm exec vitest run apps/runner/src/protocol-dispatch/runtime.test.ts --test-name-pattern='production server, runner and CLI'`：实际选择1项通过，14项未选择，3.09秒。使用真实生产server/runner/CLI、官方SDK peer、持久产物与独立验证；0模型。
- root typecheck通过；P02模块路径对f942源码diff为空，未重跑其已审15项全部矩阵。
- 集成WPF-M02到36d8d92后，锁冻结离线安装成功；Web投影显式20/20（1.39秒），Web typecheck、生产build通过（约0.28秒）。Web manifest未新增依赖；不重新应用历史锁patch覆盖已统一SDK依赖。
- 原WPF作者10task真PG/HTTP4组、独立root20投影/真实CUA7/8chat、Approve/artifact、split/merge、窄屏tab可见性证据保留于 docs/evidence/wpf-m02；本轮只做必要差异整合。

## clean-code / 限制

共享schema与模块实现保持唯一，client薄传输/命令稳定key、PG迁移4→5顺序和身份hook核对通过；受控合并冲突只选原owner完整文档与已审共享文件，未借integration新写领域实现。C02/M02摘要由其唯一owner交付记录接收。未增加层、broker或付费调用。

不声称自然语言goal编排、MCP持久input-required、多runner并行、真实PTY/fs、npm插件隔离或100agents容量完成。M1已封存的5次真实模型预算未新增。统一Web完成的是确定性多任务交互场景，语义解释与目标到计划仍由O01/E01继续。

## 2026-10-06 03:41 UTC 第二接收批次

main/origin已于本记录前实际推送4e817611b669579f6194d27a09031ae30cefa2a6：O01 a4e1348/metadata6bb领域+F01消费者2b754（Root只读批准）；R03 9c59740/metadata7808126（Mika独立48/48及source/证据hash复核）；WPF-P01 6ce/I01 92a/metadata b584（外部Root独立24项/CUA）。D05 cad1251与X01 c217文档早一批edee已推送；4320实际切换并由Root用户页面验收。

集成只做必要差异与兼容性检查：Web源码相对b584零diff，frozen offline install/typecheck/build通过（两个>500kB chunk警告保留）；O01源码/任务受理/migration/goal-tools相对6bb零diff；组合root typecheck及真实PG目标CLI1/1 1.07s通过。原始stdout见web-host-*.txt/goals-lease-*.txt。不重复R03 54或Mika48、O01 11、外部24/9browser/3PG旅程，0模型。初步O01 merge因早期cherry历史出现add/add全部取owner完整6bb，无手工改领域逻辑；raw stdout空白保留，不以原证据whitespace改写结果。

CHAT薄client841获Root源码/保存5项输出只读批准，仅传输/export；中心和真实回复尚在CHAT01/02，main接收接口不意味着聊天系统已完成。两轮native预算提案已条件批准，三端独审+实际main/配置固定后才运行，当前0调用。三队与39来源登记为metadata，仅注册校验/路径检查，不重跑产品全套。架构图仍固定3773，O01/I01/R03结构已主线的刷新由D05 owner维护待办。


## 2026-10-06 03:59 UTC 第三接收批次

完整集成候选012b676c13e5419935a92080406264191ddf2c77，来源逐项固定：CHAT01 typed d0f/metadata a9da（Root只读批准）；CHAT02 core2e+testfcbc/metadata42be（Execution Lead独审）与shared37ab（Root只读批准）；X02 core3d/metadata522703（Root批准）+F01 plugin消费者095497（Mika独审）；B01 impl70af/metadata b563（Mika独立8/8及真实after方法/数据批准）；Web PERF02 impla87f/metadata172d（外部Root独立13项和三规模内容hash审查）；E01 auth8e23/Paseodb2方法与观测（Root只读批准，禁止解读为产品安全采用或真实工程harness已选定）。

各范围与已审来源核对零diff：B01两产品文件、PERF02 workspace-feed与窗口tests、E01 auth/Paseo原文probe、CHAT01 domain/contract、CHAT02 core与已审testdelta；受控merge无手工冲突修复/新领域实现。root typecheck与现有Web直接消费者typecheck均过，原始chat-plugin-typecheck.txt、chat-contract-web-typecheck.txt。PERF02与此前I01一起的Web类型检查另见performance-web-consumer.txt。没有重跑性能样本、Auth/Paseo probes或模块全套。

CHAT生产直接consumer只选择3条、3/3（另外19未选）3.38s，已保留F01原始chat-production-consumer.txt：合成SDK实际adapter两轮/同native session、正文pending→success与重启去重、unknown与lazy长正文。CHAT02自身正式入口10/10整suite7.40s保留原失败/HTTP残留诊断及测试清理修复；这不证明生产graceful shutdown已修，R04独立准备。X02公共CLI真实PG1+client4共5/5，2.25s，登记仍unavailable，不假称npm安装/宿主加载。

root lock和生产依赖未变；新增007/008/009按独立迁移编号在serve之前初始化，产品Web不能直连PG。41个dashboard来源新增CHAT03/P03只指各owner既有唯一三件套，不创造重复进度。架构图3773固定基线需后继同步本批结构，保留明确待更新。

新Web聊天WPF-CHAT01仍在外部独立验收，未接收移动实现；本批main具备后端与正文事实，不宣称用户现在49922 fixture已变真实聊天。真实模型0调用。两次live预算仅在新Web也独审/main完整后使用；每query原始SDK估算known与保守上界，resume产品usage增量unknown如实保留。R04生产停机与CHAT03选择能力独立推进，不为新feature阻住本批已审交付。
