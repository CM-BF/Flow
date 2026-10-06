# P01 / W01 / D03 集成片段

2026-10-06 02:35 UTC，Execution Lead / gpt-6-astra ultra。独立组件审查：P01 fb14d351b46da69b17e48e8815006fc320e765e1、W01 cb4a39211e264538704ba9d474eeb08fc4b2759c、D03 260d53cb3d414b5bb87113ebb4e4c5df92127d4d 均已批准，范围见各review。I02整体多任务产品验收仍open。

## 必要整合检查

依赖由Lead统一：W01原锁patch以原F00锁为基线，不能直接覆盖新增SDK importer；以其完整新Web解析树为输入，pnpm9.15.4离线补齐当前workspace manifest，生成72278b22锁提交。frozen offline安装成功，无下载；root与Web typecheck通过、Web公开HTTP 10/10通过，生产build通过。JS块520.89/562.05kB（gzip157.10/169.68kB），>500kB提示仍保留为后续性能输入，不冒充性能预算通过。

P01独立复跑官方A2A bridge6+MCP peer3+A2A client2，11/11，4.55秒，0模型。D03独立21/21及Chrome四视图/行为通过；集成追加两个实际owner registry来源，相关registry边界1/1通过，22源实际aggregate三个WPF均live/issues空。4320发布前仍旧服务，另记实际切换证据。

## 新Thread真实中心旅程

[最终原始检查](thread-system-final/checks.json)：真实PG、独立中心/runner/CLI和整Chrome进程；确定性adapter，0模型。task `4814a26f-fd35-405e-9c82-3c4ac7b1f06a` / attempt `f59d276d-5efd-4aa9-943b-ad242bc89975`；三个浏览器均正常退出。受理queued后关闭浏览器并重启中心，runner执行到waiting，CLI同task/attempt批准，新浏览器看到succeeded与独立flow.text验收passed，artifact版本与verifier匹配。展开前0详情、产物1、验证后2；另一任务CLI取消终态且0artifact；页面错误与清理错误均空。

旧probe连接标题/主题/active pane/detail定位随官方Thread改变；首次选择器因两个挂载composer失败且完整清理，[失败记录](thread-system/checks.json)保留，不是产品失败。修正后行为通过[第一次记录](thread-system-verified/checks.json)；实际查看窄屏时导航仍开着会覆盖内容，增加用户关闭导航的真实动作与可见断言，最终窄屏深色详情已实际查看且无水平溢出，桌面浅色也已查看。未改变业务代码或降低既有断言。

限制：本旅程验证新版Thread保持M1持久闭环；不替代WPF-M02跨任务10项目标、自然语言编排、实际模型或跨机恢复。P01出站持久调度由P02继续，D03范围树证明不等于任意未声明路径也已审。

## 技能/clean-code

本段find-skills复用本地已固定codebase-design/clean-code，React集成读取vercel-react-best-practices/assistant-ui/ai-elements/webapp-testing。实际核对Flow中心唯一状态权威、官方Thread/AI Elements源码职责与许可，不安装AI Gateway或重造状态管理；流式页使用明确ready locator，不使用networkidle。保留体积事实，未凭规则机械拆组件。

## 独立集成差异复核

assignment_review / gpt-6-astra 于2026-10-06 02:37 UTC只读 APPROVED `873738d9eb998c10bc71721d9b325fcc76ecd7b5` 的probe与registry差异：断言未弱化，final checks五份源码hash独立复算吻合，完整browser退出、同task/attempt、产物/verification、0→1→2详情与取消0artifact保留；两个新增WPF权威status实际存在。未重跑整旅程/模型，不把此结论扩张为未实现M2产品能力。

## 2026-10-06 04:26 UTC 小批次：X03 / O02 / D06

接收独立批准的固定源码：X03 `895c8999d22fb3d911de2d46969e37b40051fdea`（final1290e7d）；O02 `d8198b13a15a0e27ef1686afa8495916a6aa8abc`（final2290f24）；D06 `ef42277ff55d1cbb76ea707836481a9788619033`（finalb4c2ab1）。分别核对模块/测试与集成树实现零差异，未重跑作者已经通过的局部套件。实际 root 与 Web typecheck 通过，原始输出见 `plugin-goal-root-typecheck.txt`、`plugin-goal-web-typecheck.txt`。

X03仅只读插件登记/浏览器host视图，App挂载仍归外部WPF-X03I01；O02仅受限MCP桥接，真实query授权与NL规划仍未完成；D06图固定8f1481d历史架构基线，不能当当前main全量事实。新增D06/CHAT04两个权威来源，registry共47；实际4320切换另记。

本段复用本地find-skills、codebase-design、clean-code：检查小Interface、中心授权与UI事实来源隔离、固定review target以及错误/限制说明；没有引入新框架或反复全库验证。
