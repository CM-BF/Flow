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
