# RENDERER01 技能与质量

## 启动 · 2026-10-06 05:45 UTC

按 find-skills 方法先检查已有本地技能，stack 为 React 19.3 / assistant-ui react 0.15.23、core 0.3.22、TypeScript/Vitest/Playwright。选择本地 `/Users/citrine/.agents/skills/{find-skills,assistant-ui,codebase-design,clean-code,webapp-testing,brainstorming}/SKILL.md`，不安装无关技能。assistant-ui 官方 llms 与当前安装源码在前段只读研究已核；本轮实际依赖安装后再次核注册接口。

brainstorming：已有 Goal Owner 批准的一页方案及精确八 scope，采用已批准边界，不重复审批。codebase-design：将名称冲突、生命周期和 provider 注册清理收进窄模块；正文/详情数据仍属于既有 projection。clean-code 固定安装来源 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；不重复联网安装。webapp-testing：官方真实组件 fixture，DOM 观测后动作，不以内部实现计数替代可见行为。

启动 clean-code 检查：主要风险是制造第二份插件 enable 状态，以及读取端口被不匹配的消息复用。方案用 P01 list/subscribe 和 context.own，消息读取必须绑定完整资源身份。尚未编写/运行代码；后续记录实际发现，不把方法说明当检查结果。

原始 [take receipt](take-receipt.json)；live 2026-10-06T05:44:40.603Z available，claim87948975 v1 active/八 scope 一致。

## 实施安全停点 · 05:53 UTC

现有依赖以 Node24/pnpm9 frozen-lockfile + ignore-scripts 安装，tracked 根 lock/manifest 无变化。官方 llms https://www.assistant-ui.com/llms.txt 已再读，安装源码 core0.3.22 DataRenderers.ts确认按函数 identity 清理，react0.15.23 与官方 Thread 原文件实际复用。

首 typecheck发现联合判别类型未拆开，已改明确 unknown/invalid 分支。首单测一例 fixture 插件版本写成1违反 P01 semver，修为1.0.0（生产语义不放宽），11局部与typecheck通过。首browser真实Activity隐藏后注册effect清理令消息data子树卸载、展开态丢失；projection缓存仍在。修复将纯disclosure状态放稳定 ReplyBindingsProvider；第二轮证明恢复成功，后续测试仍按旧“停用会折叠”预期失败，改为断言停用保留已打开正文。两原log保留。

clean-code：注册表只读 P01 状态，无第二 enable/grant；attachment清理携自己的token，dispose释放abort listener；subscriber异常隔离保留diagnostic，不能阻断其他provider。wrapper的错误边界key由本attachment代际决定，不再随任何host通知重挂。Root预审指出全量JSON fallback与turnId无上限，已改深度3/每集合8/48nodes/字符串512/总输出4096的摘要，getter不执行，公共id128上限；补循环/大数据/抛schema测试。custom declaration.parse 的detached/不可变输出是可信声明实现前置条件，本模块不会复制任意未界定的数据；builtin parse实际新建并freeze，两者在interface区分。

## 交付候选 clean-code · 05:57 UTC

六实现/测试文件固定747cbe6，实际14局部/typecheck/10browser通过。复核命名/职责：registry只管声明与P01拥有的attachment，React桥只注册局部wrapper，reply port不存body、不增grant；fallback预算与id128已落实。修复Activity后disclosure只存UI布尔，真实详情仍在ConversationProjection；read结果不写React内容状态。metadata阶段不再修改实现。

最后目视发现早先窄屏截图在resize后滚动位置尚未归位，无法证明内容可读；补固定fixture flex剩余高度包裹与真实Enter/Space+可见按钮等待，再捕获最终390dark，内容与焦点可见，0水平溢出。最终日志/截图均绑定固定747cbe6；不拿空白图当已验。

剩余限制：自定义trusted parse须产detached immutable值（builtin实测已freeze）；每provider只挂单bridge并替换旧命名注册；App host/connection epoch与read授权要在未来接线验证。本片无第三方代码隔离，不自动授予读取。0新依赖/根lock变更、0模型/产品DB/全库检查。
