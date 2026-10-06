# PERF03 技能与质量

## 2026-10-06 07:25 UTC 启动

按find-skills方法优先本地，实际读取/复用：/Users/citrine/.agents/skills/find-skills/SKILL.md、assistant-ui/SKILL.md、codebase-design/SKILL.md、clean-code/SKILL.md、vercel-react-best-practices/SKILL.md。无技能安装。clean-code固定用户来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；React技能metadata v1.0.0。派发Astra ultra，环境标识GPT-6，不冒称独立型号API证明。

assistant-ui官方[llms.txt](https://www.assistant-ui.com/llms.txt)本段已查；实际行为以安装react0.15.23/core0.3.22源码为准。已核core的message对象WeakMap与自动尾status，不能用缓存回调数代替React渲染。codebase-design保持一个现有interface、内部弱缓存；React建议保留稳定converter但不memo动态adapter。

clean-code启动检查：只缓存纯展示值，不写中心事实/创建第二状态源，不用ID或revision作为陈旧缓存键。已批准普通整改直接执行，不重新设计审批。正式tests/source/probe完成后记录实际发现与修复。领取与live观察见[take-receipt.json](take-receipt.json)、[claim-observation.json](claim-observation.json)。

## 2026-10-06 07:28 UTC 实现安全停点

原实现新增8case中4失败/4通过（red-tests.log），失败直接证明真实projection未变化刷新仍重建消息和实际core重复转换。实现仅messages.ts添加WeakMap，接口与Thread/projection保持不变；两文件局部85（新增8+直接projection77）通过。首次typecheck发现fixture使用了不存在的adapter版本/缺失原因literal及两处可选status读取，已改为真实共享literal/可选读取，保留typecheck-initial.log，待复跑。没有降低行为断言。

clean-code复核：弱缓存按整个不可变turn对象，避免正文相同但source/version变化被错误复用；不缓存flatMap结果数组，分页顺序仍由调用者输入确定；不建强ID表、计时器、连接或draft状态。真实core探针通过已装固定内部导出只读测量，生产模块不依赖internal。实验不报告耗时或React渲染。依赖frozen+ignore-scripts安装3.8s通过，rootmanifest/lock零diff，本树client/contracts链接本树packages。

S01-W2测量静默07:28:00–07:28:30Z时无重进程，期间只改fixture类型与文档，未启动测试/构建/服务。

## 2026-10-06 07:31 UTC 固定交付清码

固定f909三个文件；最终8测试通过（510ms总、63ms tests）、Web typecheck通过。既有77直接projection已通过且未改，最后fixture类型修正后只复跑受影响8项；原始85和4红记录都保留。source只在测试后澄清不可变使用前提的注释，运行逻辑相同。

真实安装core0.3.22小计数07:30:09.368Z产出exit0：100turn/200messages，未变3次candidate同对象200/回调0，基线0/200；更新末轮198/2，running/stopped各1，草稿与请求数一致、detail0。核raw数值与3source/current/target hash相符。0回调不等runtime零遍历、零React渲染或零延迟；不报告GC或无泄漏。

clean-code复核命名/职责/错误/重复：一处WeakMap承担对象复用，原mapper接口、日期、ID、data标记和顺序保持；test/probe共享合成数据与真实runtime启动帮助函数，生产不依赖probe/internal导出。输入/输出不可变为显式前提，未为了未来假想mutation造版本系统或冻结整棵DTO。无新的未处理作者finding；独立review保持NOT_STARTED。保护Thread/App/projection/shared/manifest/lock无差异；本树client/contracts正常。

静默补充：原07:28窗口后只运行最终8与typecheck，均在07:29:30新窗前自然结束；计数07:30:08Z后启动并自然结束。后继至07:32:30 quiet lease期间无新tests/build/install/PG/服务；只做文档/hash校验，旧预览不变。
