# WPF-MATURE-03 附件与文件上下文真实发送

| 字段 | 内容 |
| --- | --- |
| 大task ID | WPF-MATURE-03 |
| 状态 | in-progress；完整验收未完成 |
| 最近更新 | 2026-10-07T05:05:57.595925+00:00；补常用文件能力的用户验收，未实施 |
| co-lead | Web /root（执行管理 d01_owner） |
| 优先级 | P1 |
| 唯一来源 | 本目录plan/status/review，管理worktree合法claim v3；不另填聚合进度 |
| 用户来源 | [成熟度原话与六项分工](../../docs/evidence/web-platform/mature-task-handoff.md)；原WPF REQ仅追溯，不形成第三层 |
| 收益 | 用户可通过按钮、拖放和@file把明确版本的材料附到当前草稿，并真实用于Send或Queue执行。 |
| 边界 | 本计划定义完整用户结果；具体实现须独立worktree、fresh精确scope take和固定独审，计划目录领取不授产品写权 |
| 依赖 | CONTEXTI01已main df29并收口释放；GO已裁定Web/root端到端负责附件；panels合同已审6bc2918并获runtime18literal；w01已取ATTACHI十一新模块范围，以固定已审DTO/typed ports并行；公共HTTP/App等准确桥接输入后接；Lead只协调占用中的共享出口/迁移编号/main。 |

## 已有能力与gap

CONTEXT01选择模块736ef和CONTEXT02深冻/ACK guard5e821已main；K01/K02提供不可变版本citation、cap及project身份。CONTEXTI01固定d0e/009e已root独审并正式main df29，owner fe2b收口后55fe v2释放。已有实际App知识UI及Send/Queue HTTP fixture证据，未代替真实provider或本地上传。

现官方Thread已包含附件按钮、AttachmentDropzone、列表/预览删除等控件，按钮由attachments capability门控；当前缺的是持久资源adapter、@file授权目录以及固定材料Send/Queue/ACK/runner输入接线，不能重复造一套控件。类型/大小/权限与固定版本送入model context仍须实现；本地上传与runner文件不能用知识模块冒充。

当前子任务来源：[ATTACH01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/attachment-resources/plans/wpf-attach01-resources/status.md)；[CONTEXTI01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-integration/plans/wpf-context-i01-integration/status.md)。该子任务直接归本大task，WPF管理只做来源追溯。

## 稳定TODO与完整验收

- [x] **WPF-MATURE-03-01** 完成已有知识实际UI子任务：CONTEXTI01从已授权project创建、cap确认后选引用；Send/Queue ordered tuple到真实HTTP并校ACK；不宣称本地上传完成。
- [ ] **WPF-MATURE-03-02** 冻结附件与文件公共接口：区分本地上传、已有知识、runner文件的来源/版本/权限/大小类型，绑定当前project/view/connection；timeline只轻引用；实用Markdown/代码文件与可配置预算的具体后继由03-07验收。
- [ ] **WPF-MATURE-03-03** 实现按钮拖放与@file：三个入口可发现；键盘替代drag；搜索有界且可取消，预览正文按需，删除只影响当前草稿。REQ22–23的Files入口之外，条目动作须后继接现P01单一registry并核view/project/fixed-ref，不用task artifact上下文冒充上传引用；[coverage证据](../../docs/evidence/web-platform/attachment-plugin-coverage-9eec.json)。
- [ ] **WPF-MATURE-03-04** 保证发送与重试身份：同一次Send/Queue深冻材料版本/顺序；unknown保原key/payload，预算拒绝保留receipt，ACK不得清新稿/新refs；异步attachment prepare期间点击意图/材料与submission/view/project/generation绑定，切delivery或新refs不改变旧提交，仅真实receipt接管后consume；材料真实进入model context。
- [ ] **WPF-MATURE-03-05** 验证多窗口与失败恢复：双split草稿独立、换连接/close/隐藏/撤权迟到隔离；不支持中心明确plaintext路径；类型/大小/授权失败可行动；journal拒绝/损坏保raw及unknown身份且纯文本仍可用，cap/namespace旧缓存按绑定生命周期失效，不凭URL复用授权。
- [ ] **WPF-MATURE-03-06** 完成实际旅程验收：真实App fixture覆盖入口到执行请求、引用审计与按需详情；provider执行验收另经明确预算，不能拿fixture证明模型收到。
- [ ] **WPF-MATURE-03-07** 落实03-02的常用文件能力后继：按实际能力声明支持Markdown/代码文本，显式可配置上传与总context预算；区分授权workspace/runner文件和中心上传资源，选择后固定版本经Send/Queue到实际runner保持原材料。使用本项目一份>8KiB Markdown与一份源文件验证，格式/上限/实现先按真实消费者冻结；当前仅需求与只读接口准备，不继承旧已完成结果。

## 常用文件能力后继（GO转述，尚未实施）

[本次来源与验收边界](../../docs/evidence/web-platform/recovery-fourth-return-20261007/attachment-practical-files-requirement.json)映射原03-02与明确后继03-07。GO据main短标识ef3a6de8报告现text-v1仅.txt，单文件和总内容为8192 UTF8B；其举本项目AGENTS.md 18655B及ConversationThread.tsx 22770B作为日常文件无法附的实例。这是GO经root转述的源码观察，非本管理者实测，也未读取或上传这些文件。

用户结果是常用Markdown与代码文本按真实能力声明可用；具体格式、大小上限与配置由真实消费者细化，不能只增大常量。分别定义上传存储字节预算、模型上下文预算和正文惰性读取，复用已有storage/context/附件Interface。@file须区分经授权workspace/runner文件和中心上传资源；选后冻结版本/顺序/身份，Send与Queue的实际runner读取保持原材料。timeline仍只有轻引用，不塞路径或整段正文，不造第二上传体系，不把上传目录冒充实时文件系统。

未来已知验收材料是一份本项目>8KiB Markdown和一份源文件；保原按钮/drag/键盘、跨pane草稿隔离、unknown重试、Recovery与provider unsupported验收。当前只登记计划并准备只读接口，未授provider或个人文件读取/上传。Recovery/Quick本次实际终态先封存；此实用能力后继优先于附件装饰或插件菜单coverage，共享backend范围与原Lead按实际claim协调，不等全部Web完成。原子片已完成历史与本大task未完成状态均不改变。

### 实用文件的共享消费边界与未领取候选

固定main ee98e65 的[root只读17源研究](../../docs/evidence/web-platform/quick-b3-admission-20261007/practical-files-interface-research.json)独立核验了GO两份项目文件字节；没有上传/执行provider。除附件与DB raw/content的8192B约束外，context compile同时限制16000 UTF16 code units与49152 UTF8B，runner claim仍用prompt≤16000且whole JSON≤131072B。只改附件常量会让实际私有assignment不兼容；须明确公有用户prompt与授权私有执行输入的兼容策略，并分别定义上传、保留和模型context预算。字节不冒模型token容量。

[共享Interface/claim候选清单](../../docs/evidence/web-platform/quick-b3-admission-20261007/practical-files-shared-candidates.json)仅作原Lead与相关owner协调：contracts/context/runner-claim→storage冻结→runners私有assignment→Claude/Codex实际adapter→Web选择/后继host。018/026是已应用的只读输入，未来只能分配新additive migration；公共exports/receipt/client与新增测试精确路径尚待消费者证明，不以整个目录抢权。fresh观察明确tasks.ts/Codex adapter由C02持有、Claude由native-activity-body持有、controller/Thread由Recovery持有；没有冲突观察的路径也未领取。现Files只是taskrefs，真实workspace授权snapshot不是把上传目录换个名称。保原选后freeze、unknown身份、惰性正文与provider unsupported边界。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

## 已安装附件接缝研究

root只读实际react0.15.23/core0.3.22：external-store-adapter.ts已有adapters.attachments，composer有addAttachment(File或CreateAttachment)/removeAttachment及submission.attachments冻结。无需预设升级SDK；[官方附件文档](https://www.assistant-ui.com/docs/guides/attachments)网站安装示例是移动信息，不作为本轮固定事实；当前本地react0.15.23/core0.3.22不升级。现版adapter接中心固定轻引用，UI选择/图片预览不证明上传或模型输入；不直接采用base64/PDFplaceholder例子，无个人文件上传或模型调用。

### 完整附件生命周期依赖（09:09 UTC GO审计）

历史09:09审计提出唯一后端owner待定；下述生命周期验收保持，责任已由本轮GO正式裁决明确为Web/root：浏览器引用必须落为runner固定可读输入，ready才可Send/Queue；删草稿、执行前重启后仍读取冻结版。上传中、失效、provider不支持须明确阻止，不能静默丢附件只发文字；取消/失败有界清理、使用中的材料不回收。MATURE02 adapter只消费该协议，04复用metadata；Web本组唯一后端worker和独立Web输入worker均须新隔离树/fresh literal take。沿原附件TODO验收，不继承已释放CONTEXTI写权。

### 附件端到端责任已确定（GO正式裁决，经root转达）

Web/root对MATURE03完整附件结果负责，授权本组唯一后端附件资源worker与独立Web输入/预览worker并行。当前panels已在attachment-resources/f181独立树完成phase1固定合同独审，ef617d78 v2共18literal已原子扩权运行域；w01已取ATTACHI十一新模块写权，实际HTTP/App仍单独后继。root统一固定轻引用、ready、授权读取与保留合同，然后各自独立worktree/fresh literal claim。ExecutionLead仅协调已占共享index/合同出口、迁移编号与main，不再把“等待Lead后端owner”作为阻塞。02 adapter消费同一协议，04复用metadata，不造第二上传协议。此前[有界owner观察](../../docs/evidence/web-platform/mature03-owner-observation.json)仅保留其历史时点，已由本裁决解除。

首个支持类型可做有界切片；完整验收仍是按钮/drag/@file→ready固定版本与顺序→Send/Queue→远端runner实际读取同材料并留输入证据。pending/expired/provider unsupported必须阻止并保草稿；不能丢附件只发文字。删除草稿不回收in-use，失败/取消有界清理；断线/重启/撤权/unknown保留身份与原键。复用project/context/storage授权、版本与预算，metadata首屏、正文按需。区分upload、knowledge和授权runner file，不用blob URL、绝对path或base64 timeline假接。先做真实PG/HTTP fixture，0provider；完整模型验收仍须单独明确预算。

### 已安装adapter与提交语义（root只读研究）

installed core0.3.22已有attachment add/send/remove接口；当前Thread.onNew仅消费text，忽略message.attachments，因此新输入必须显式映射授权不可变refs，paperclip/预览不等于已发送。现core remove仅对尚未complete的attachment调用adapter.remove，center/outbox负责保留与in-use回收，不能依赖删草稿回调。官方[附件指南](https://www.assistant-ui.com/docs/guides/attachments)与[custom adapter](https://www.assistant-ui.com/docs/integrations/attachments/custom-adapter)仅作为方法来源，当前网站推荐版本不构成本项目SDK升级授权。本段无上传、provider或实际附件输入验收。

当前两案和共享单写边界见[附件依赖清单](../../docs/evidence/web-platform/attachment-shared-dependencies.json)。后端WPF-ATTACH01的schema phase1已审6bc2918/final339086；runtime已v2领取18literal，Web整体23仍候选未预领；F01 v23已释放contracts/conversations.ts，026已预留，F01保留公共出口/client/server index。Web调用点与TUI共享ACK迁移须一个owner/有序窗口，不能因09:51无writer就预领。首.txt限制、TTL/配额与template2设计方向已由root冻结，typed SHA已独审待Lead受控发布/exports；后端runtime8701已root78独审（真实隔离PG/HTTP）；publicclient/ACK-v2/生产mount与App仍待接，不能把后端fixture当产品已连通。

### 共享回执与上传恢复接缝（root/两owner只读方案）

attachments[]/template2固定shape交F01唯一公共receipt decoder扩展，保旧template1与Web queue matcher，不另造第二份ACK验证器；附件UI与该输入成套接收，后台资源可先独立推进，不阻TUI首片。Web候选改recovery.ts替代自有receipts.ts，恢复查找/expiry/replay/pin与浏览器有限metadata intent已root冻结，ATTACHI首片按typed注入ports实施；不复制publicdecoder。unknown lookup404不证明未提交；重选原文件同digest/length/metadata才能原key重试，ready不自动附到新稿。16条/64KiB恢复journal为已授权首片预算，recoveryScope只是命名空间不授权，跨reload未知Send/Queue未因此获恢复承诺。详见[集中依赖](../../docs/evidence/web-platform/attachment-shared-dependencies.json)。

### 旧客户端兼容矩阵（固定f181源码研究，待实际consumer验证）

沿[逐路径研究](../../docs/evidence/web-platform/attachment-v2-compatibility-research.json)：仅每请求非空attachments生成template2，省略/[]和原v1 receipt重放不变；不能按项目或会话升级。旧bundle可读v2 turn/queue正文但不展示材料，明确这个限制。新bundle对旧center缺cap禁附件，plain请求彻底省略attachments而不是发[]，旧strictObject否则拒绝。F01唯一shared decoder验v1/v2 exact ordered identity，恶意v2 ACK对v1请求仍unknown保原key/body。此矩阵并入03-04/05/06验收，不增加无证据的Accept协商或GET字段剥离；真实legacy/current HTTPfixture尚未执行。

### ATTACHI01已授权独立输入模块

基线8701a6cf547248e70aa5758f05da1d7d314ae9c0已审DTO，94b84c59 v1十一新scope、w01唯一owner，直接归本大task，[精确方案](../../docs/evidence/web-platform/attachi01-module-proposal.json)/[原子receipt](../../docs/evidence/web-platform/attachi01-take-receipt.json)。controller/recovery/Picker/官方Thread fixture使用typed注入ports与已验证receipt，adapter仅官方UI接口；禁止私写HTTP/重复ACK或upload decoder/虚构公共方法。真正FlowClient六方法、实际HTTP、App Send/Queue接线保持pending，后续消费固定public bridge前核base兼容。不预占原23scope、不把独立组件审过当完整附件Done。

### 异步attachment preparation与提交意图（root固定c450/installed core只读）

installed core0.3.22的Composer.send先快照text/attachments/options，随后可能异步_prepareSubmission；ExternalStore.append最终读取当前_store.onNew。固定c450 ConversationThread在onNew时读取当前intent/profile/knowledge.capture。因此新增异步附件准备后，点击Send到onNew之间切换delivery/knowledge/project可能混入新状态；这是源码风险，尚未browser复现。ATTACHI capture/freeze/consume须绑定同一次submission、view/project和generation，只有真实新receipt接管后消费；后继生产接线必须捕获点击时意图和材料，不能Send变Queue或把新draft refs混入旧submission。本片在原迟到/complete绕过fixture中用可控延迟验证，不扩App/Thread scope。

来源root读取本地assistant-ui skill→llms.txt→[官方custom adapter](https://www.assistant-ui.com/docs/integrations/attachments/custom-adapter)，以现react0.15.23/core0.3.22行为为准，不升级SDK。clean-code复核单一状态owner与异步生命周期；不是已确认当前纯文本产品bug。

### 正式factory接通前的升级验收

03-05/06包含真实pre026数据库保留原v1行/原receipt，首次026后完整factory通过HTTP原key重放且namespace重启稳定；不能由createServer提前升级后仍宣称验证旧库。普通/child fixture以全部route存在消费production、部分存在失败、全无仅兼容旧factory，分支来源写入新固定报告。旧8701/78实证保留；本轮两fixture文件与六受影响场景由原合法owner处理，生产mount专测由共享owner处理，不新增公开测试开关。[具体固定输入与交接](../../docs/evidence/web-platform/attach01-fixture-handoff.json)。

### 生产宿主接线的错误隔离验收

root本轮只读发现createAttachmentInput初始journal list可因storage拒绝或损坏抛错；生产宿主须隔离为附件可行动错误，保留raw和unknown身份，纯文本Thread继续，不自动清坏记录、不让Session整体卡死。cap null/旧namespace缓存在重连或升级时由明确binding生命周期重建/失效，不能仅凭URL复用授权。与CACHE知识binding回收可能共享session.ts，精确take前先排单writer窗口。这是原03-05/05-05后继要求，不是已审4c4d模块已经验证的行为。

### 公共桥接固定输入状态（管理只读核11:28）

六client ab1b及shared ACK-v2 df8d分别已获Mika/native_center_owner独审；factory69eb的P2仅生产专测清理，f04修复仍按F01 11:27权威status待增量复审。实际main53ce未含附件mount/六方法/v2分支，不能把作者3/3或分支可用当main能力。完整manifest与review归因见[只读观察](../../docs/evidence/web-platform/attachment-public-bridge-observation-1129.json)。CACHE小Interface先结构审查/精确take，ATTACHI实际App/session绑定随后明确交权；free账本观察不是预占，原独立模块claim不变。

公共client消费者精确事实（已核固定ab1b）：回执方法为attachmentUploadReceipt，不是早期简称attachmentReceipt；六方法仅response.json类型断言，runtime schema/receipt identity仍由公共合同及输入模块验证。生产host只对明确unsupported/receipt404作有限映射，不吞401/403/其他409/坏200，unknown身份保留。03-04/05沿[统一桥接记录](../../docs/evidence/web-platform/attachment-runtime-public-bridge.md)验收；[24literal生产绑定只读方案](../../docs/evidence/web-platform/workspace-cache-attachment-binding-proposals.json)未获take，与CACHE含两专测共六处交集须串行。

执行安全点（11:34）：附件运行域/公共桥接已受控main fd1322；独立UI模块4c尚待main。CACHE root批准16literal后已fresh COMMITTED883321 v1，六共享路径含两专测先CACHE后ATTACHI02。双方保护pending composer submission/capture，即使items已移除也不自动回收；未提交profile/project选择才属选择保护。范围、容量、输入与收口见[当前集中队列](../../docs/evidence/web-platform/mature-task-handoff.md)及[精确方案](../../docs/evidence/web-platform/workspace-cache-attachment-binding-proposals.json)，不继承旧claim。

ATTACHI02生产验证准备（12:00）：[只读矩阵](../../docs/evidence/web-platform/attachi02-production-validation-matrix.json)已root结构认可，未执行/未take；仍等4c模块正式组合main。真实factory+FlowClient+生产App、026/六routes/fallback=false，累计600s含构建启动与每轮20s清理；pending capture失效在local handoff前0receipt/0POST保原text/refs，实际receipt同步接管后才consume，不以ACK清新稿。旧center缺cap的proxy仅模拟，token/正文不入日志。

12:07输入更新：4c模块已正式main1c496，ATTACHI02新树首12 fresh受领，不再等待模块输入。完整生产消费者仍沿原TODO，第二阶段余12需fresh amend；上述验证准备不是已执行结果。

同既有附件预览/键盘窄屏验收补证：ATTACHI02 f82真实合法255 UTF16unit ASCII/中文emoji文件名在浅深390的Picker/恢复动作导致Dialog横溢与焦点不可达（root P2 REQUEST_CHANGES），功能191项不抹掉。仅原任务追加Picker与CSS两literal，0b7fc000 v3/26scope已fresh committed；保持完整名字/aria及语义，visible动作精简/网格换行，定向复验新target后才接收，见[原诊断与领取](../../docs/evidence/web-platform/attachi02-longnames-request-changes.json)。原controller/recovery/adapter未授权修改，不另造视觉task。

### @file 快捷键的实际聊天消费者边界

沿原 MATURE03-03 与 MATURE06-04 键盘验收记录[固定源码发现](../../docs/evidence/web-platform/web-artifact-cleanup-fix-source-reload-20261007/file-tab-keyboard-followup.json)：main9a815eca7 的 ConversationThread 在已有 prevented/IME guard 之前处理 @file+Tab，且未排除修饰键；官方组件先调用消费者 onKeyDown，独立附件 fixture 的正确 guard 不能代替真实 App。此为静态控制流发现，未声称真实 IME 复现。

下一合法 owner 在独立树与精确领取范围内修快捷键判断顺序和边界：普通 @file Tab 保持有效；Shift+Tab、Ctrl/Alt/Meta、已 prevented、composition/keyCode229 不抢焦点、不打开附件、不发请求；保 Enter/Queue/Steer。只测实际消费者受影响路径，不重跑完整 IME 或全库；不重建当前固定 Web 产物、不打断发布，已排用户可见共享浮层片仍优先，不新增大task。

### 附件条目动作的同一插件授权边界

沿 WPF-001-05 / REQ22–23 / 原03-03接受[固定七源接口研究](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/attachment-action-report.md)。后继复用同一 `attachment.item.actions` 插槽、Host/session/binding 与有区分字段的 draft/project/recovery 上下文；首片仅提供两个真实行的预览：项目文件行和实际 Composer 草稿行，不把 task artifact 或恢复目录身份当草稿成员，不暴露 client/controller/任意回调。读取与草稿修改权限分开，执行及每个 await 后重验当前成员、固定版本和 lease；卸载不清草稿、已提交材料或未知回执。

原 I01 react/session 写权交回后，由既有接入 owner 在独立树合法领取最小范围；先核现有 `attachments/controller.ts` 的 preview/取消 signal 接口。只有确有缺口才精确扩该文件与行为测试，不新建缓存或第二状态权威。两消费者验收包括跨项目/撤权/卸载后的迟到拒绝，移除 A 后不回填 A、不改 B 或附件顺序。此为可实施设计输入，未领取、未实现、未运行；不能阻断已固定新网页发布或当前视觉片。

[独立反馈采纳](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/attachment-action-design-decision.json)进一步固定首片 preview-only：行展示复用 `recoveryDraft` 的实际 membership，不能把含 held 材料的 `input.items` 当当前稿；同连接/view/project与权限布尔值不代表授权仍有效，复用私有 liveauth generation 与 exact binding/projection 即时撤销。单命令 signal 必须贯通实际 HTTP、缓存提交和 Composer 提交边界，不能只在 await 后抛错而宣称撤销了副作用。后继先只读核 controller/App/ConnectionSession，必要才扩精确写权；本研究不扩大当前 I01 或视觉范围。

键盘后继修复边界进一步限定为 `@file + Tab` 分支本身：先排已处理事件、IME/keyCode229及Shift/Ctrl/Alt/Meta，再执行普通mention Tab；不要在整个onKeyDown函数统一对所有modifier早退。保留后续Ctrl/Meta+Shift+Enter提示、普通Queue Enter和assistant-ui默认处理。此固定9a815控制流复核沿原03-03/MATURE06-04，不扩大当前Release/I01范围，后继合法owner在独立小段实施真实消费者回归。

既有条目动作后继收到[固定六源controller补充](../../docs/evidence/web-platform/host-i01-newpair-queue-20261007/attachment-controller-seam-peer.json)，仍仅设计输入：复用draftItems/recoveryDraft与现bounded cache/HTTP组合signal；激活前捕获当前行和授权世代的invocation lease，对cache、capability、body、digest和error每个提交点即时核验，不仅最终body。未读的具体HTTP abort与其他row API不能假设。现七源候选之外最窄可能增加App/controller；connection/session无需由本研究推定修改。等I01正式释放后由合法owner fresh领取，当前不新增任务或实现权。
