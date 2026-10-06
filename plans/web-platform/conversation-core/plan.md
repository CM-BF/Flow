# WPF-CHAT01 真实持续对话准备

更新：2026-10-06 03:25 UTC。用户U11由原Goal Owner经root转述，未提供整段逐字原话，父[REQ41～45](../plan.md)保存准确摘要。当前优先级1。唯一准备owner d01_owner / gpt-6-astra ultra；root只读研究/独立审查；原w01_owner先只读接口调查；主线中心/runner owner及后续Web实现writer由明确派工/claim固定，不虚构已开工。

## 用户可见目标

用户发送hi得到真实模型自然回复，可以在同一会话追问，断线后恢复已有消息与在途状态。消息正文和用户/assistant气泡是首页主体，工具、可展示thinking、引用为辅助下钻。49922当前是固定HTTP fixture，其center/runner/result与Field notes/Verification卡片不是自然对话；原tab/服务保留且明确演示性质，不能暗中替换或重启。真实产品验收使用另外明确标识的真实中心与runner入口，遵守模型/预算和权限边界。

模型选择、thinking/effort、access权限模式、context、files、语音、发送、queue、steering必须是可用能力的真实消费；不做只改变UI标签的假控件。I01现有插件主App接入继续完成，不因新计划抢其App/Thread/workspace范围。PERF02仅准备暂缓，未amend/take/创建新树/生产写入。

## 分阶段契约与验收

| 阶段 | 所需权威接口/行为 | 可检查结果 |
| --- | --- | --- |
| A 能力与会话最小核 | 中心capability catalog提供实际provider/model、effort取值、access模式及授权范围、context/files/语音/queue/steer支持；会话ID/turn/run身份、持久消息、发送ACK/幂等、分页/恢复语义由中心冻结 | 未支持项明确disabled/说明，不硬编码假模型；hi自然回复与同conversation追问；ACK丢失不重复产生turn，重连恢复真实记录 |
| B 发送与正文 | 官方完整Thread保留，真正多turn通过支持的runtime/公共client适配；自然用户/assistant正文优先，生成中/失败/取消/未知结果明确 | 发送、消息气泡、输入草稿/错误保留、keyboard/窄屏/双主题/reduced-motion；既有任务不是每次新task就伪称同会话 |
| C 工具与可展示thinking | 初始列表/快照/SSE只含id/title/状态/允许摘要引用，不嵌大量内容；展开用鉴权detail按resource+version读取。thinking只渲染provider明确提供且允许展示的内容或摘要 | 初始0detail、首次展开1、重复缓存；初始响应/SSE字节与payload结构实证；无thinking来源时不编造，不把隐藏内部推理冒充可展示输出 |
| D Queue | 中心持久队列，明确排队序号/同会话顺序、受理/执行/取消/重连、并发与幂等；权限和在途结果由权威态决定 | 运行中排队、顺序执行、撤销尚未执行项、重连/中心恢复保留；取消队列项与取消当前run区别清楚 |
| E Steering | 运行中目标conversation/run身份、steer受理ACK及实际应用位置/拒绝理由；runner明确是否支持下一安全点生效 | 运行中steer被确认后展示实际生效/未支持，不偷偷另建task；旧run/旧revision拒绝，HTTP超时仍待核对而非声称生效 |
| F Context / files / access | 中心授权context/resource版本与文件能力，权限模式影响真实执行gate；不传任意宿主路径、不将浏览器toggle当授权 | 选择context/files后同turn绑定固定来源；越权/不存在/过期/未支持可见；文件只读/上传/写权限各有实际契约，不与产物引用树混淆 |
| G 语音 | 录音设备许可/开始停止与转写服务分开；明确现有能力，未支持不偷接付费服务 | 录音失败/转写失败可回文字并保留已有输入，清理设备流；真正转写需单独实际能力/授权来源，无服务时明确未支持 |

## 所有权、待解接口与领取

中心/contracts/client/runner共享变更只能由原Lead安排其唯一owner。本队先只读核现有contracts与public client，输出已支持/缺失/可安全复用表，交Lead固定最小合同和owner；不能在App临时造第二会话权威、provider调用或队列数据库。

Web后续独立worktree/branch与平级canonical计划，开工前读dashboard+liveGit+status+claim，必要等I01固定交付/停写并正式amend→take；不以不同worktree掩盖App双writer。内置界面延续plugin接缝，不重写另一套host。完整需求可以分数个独立feature交付，本准备总验收不能因首阶段通过而消失。

真实模型旅程由原Goal Owner/主线按既有预算与认证安排；未获明确真实调用边界时先做公共协议fixture和接口检查，并标其不能证明自然回答。不会安装/触发付费语音、上传用户文件或读取凭据来凑效果。

## TODO

- [ ] **WPF-CHAT01-01** 持久化U11并完成现有capability/session/message/queue/steer接口只读清单；由Lead明确各阶段唯一owner和最小共享合同。
- [ ] **WPF-CHAT01-02** 在独立领取范围接入真实最小持续对话：hi自然回复、同会话追问、断线恢复、幂等发送与正文气泡；共享与Web各自验证。
- [ ] **WPF-CHAT01-03** 实际capability驱动模型/effort/access/context/files控件；未支持明确，授权作用和来源版本可验证。
- [ ] **WPF-CHAT01-04** tool/可展示thinking仅轻引用首屏/SSE，展开鉴权懒详情0→1→cache；无来源不伪造。
- [ ] **WPF-CHAT01-05** 持久queue顺序/取消/恢复，以及运行中steering确认/生效/拒绝的真实语义与端到端场景。
- [ ] **WPF-CHAT01-06** 语音录音/转写分离与文字fallback；只有实际支持能力才启用，无暗接付费服务。
- [ ] **WPF-CHAT01-07** 固定target独立review、主题/窄屏/keyboard/真实中心与真实模型证据分开、dashboard来源/claim及Lead集成闭环。

## 检查门槛

每段先模块+直接依赖；公共契约变更覆盖相关链路，纯计划只查链接/ID/事实。持续跟踪client abort不等于取消服务端任务、跨连接同ID隔离、过期decision/steer不自动改身份重发、关闭视图不取消。未经独立审查review保持NOT_STARTED，运行前后实际证据区分fixture、真实PG/protocol runner和真实模型。
