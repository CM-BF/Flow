# WPF-RELEASE01 review

**当前状态：APPROVED，固定连接策略源码、c3四App正式兼容与完整RETURN均已独审通过；main/个人部署待接收。**

Review target commit：d882c9439ee0111268e18766bf13ed02d6fb86e5。范围：apps/web/test/web-release-compatibility.browser.ts、apps/web/test/web-release-compatibility.fixture.ts。

[固定差量/输入](../../docs/evidence/wpf-release01/recovery-cookie/connection-policy-candidate/README.md)：仅fixture的native httpRequest增加agent:false，与原Connection:close一致。browser逐字fc291；formal4父/worker/计量/输入配置逐字c2。原console400严格断言、Cookie/ACK/key/body/task/lateLogout及清理不变。此为具源码依据的候选，不宣称唯一根因或修复已验证。c3首次实际已生成四正式report，见[本次原件](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-third/README.md)；[Root实际独审](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-third/root-actual-review.json)独立批准同一固定pair，0blocking。26788/180000ms CLOSED，完整RETURN；不冒新UI/主题、main/部署或唯一历史根因。

[Root限定独审](../../docs/evidence/wpf-release01/recovery-cookie/connection-policy-candidate/root-source-preparation-review.json)结论 APPROVED_FOCUSED_SOURCE_AND_REUSED_PREPARATION_NOT_RUNTIME，0blocking。TMP binding现为REVIEWED_SOURCE_BOUND；native边界仍复用7bfb988，五prepared/source tuple不改。实际须d01新窗口/fresh完整准入，不从审查推导运行授权。

## 历史：fc291诊断源码、必要strict与首次诊断实际


**当时状态：APPROVED，仅固定诊断源码和精确native准备；诊断首次实际捕获/完整RETURN已独立接受，正式四App兼容仍FAILED。**

Review target commit：fc2916c275efe86203d91ec33656ea9871eac42a。范围：apps/web/test/web-release-compatibility.browser.ts、apps/web/test/web-release-compatibility.fixture.ts。

[Root源码集中审](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/root-source-review.json)已关闭唯一保存字节计量P2，0blocking；[固定native边界](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/root-native-boundary.json)仅接受parent3872/worker8554。正式四App断言/import协议不变；只读有限观察不读取敏感报文，0error不证明问题消失。

[必要类型实际](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/strict-actual/README.md)：首resolver配置FAILED原件保留；同source仅修现有zod路径后strict/noEmit exit0，两个actual共2775ms/20s CLOSED且完整归还。[Root独立实际审查](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/strict-actual/root-result-review.json)已接受最后strict PASS及首红保留；不冒浏览器或compatibility通过。真实K01重叠时段保留，不将本次当性能结果。

首次[诊断actual](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/actual-first/README.md)已实际完成，outer0/DIAGNOSTIC_COMPLETE仅说明捕获完整；1条HPE_CLOSED_CONNECTION关联UNKNOWN，passed=false/reports=null。90s段14881ms CLOSED、完整RETURN，[Root actual独审](../../docs/evidence/wpf-release01/recovery-cookie/cookie-parser-diagnostic/actual-first/root-actual-review.json)ACCEPTED，仍不是兼容批准；不可据此部署。UNKNOWN原key恢复仅覆盖reload后/logout前，不证明新登录后UNKNOWN恢复。

## 历史：d032源码及第二实际失败


**当前状态：APPROVED，仅固定源码/准备。实际兼容仍FAILED；完整RETURN已独立接受。**

Review target commit：d032a53a62017cc41a3ddf19b316ad1047398fa6。范围：apps/web/test/web-release-compatibility.browser.ts。[Root源码集中审](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-second/root-source-review.json)0blocking；[第二实际/失败归还审](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-second/README.md)接受真实outer1/26554ms CLOSED、完整清理，不接受compatibility。reports=null/不可部署。

[限定诊断](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-second/diagnosis.json)：新App已到达原key/body显式恢复与迟到登出后续；console断言遇到唯一GET browser-session400，响应hash匹配Fastify HTTP clientError通用正文。具体parser code/连接事实未采，不能笼统allow400或声明后台业务回归。UNKNOWN retry覆盖reload后/logout前，新登录后的UNKNOWN重试未验证。

## 已审历史：pair准备与首实际失败

**当时状态：APPROVED 精确pair源码/调用准备；首次actual FAILED已独立核验，不是兼容批准。**

Review target commit：2f6792ca3f19fcd1d54563531c302937f607c892。范围：apps/web/test/web-release-compatibility.fixture.ts。原browser逐字8964；[源审与native批准、首次失败实际](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-first/README.md)分层归档。180s段CLOSED56504ms，完整RETURN；旧三App只有阶段完成，reports=null，0正式报告，newApp lateLogout未真正发请求。

[只读归因](../../docs/evidence/wpf-release01/recovery-cookie/pair-779a-cd27-first/diagnosis.json)定位harness等待cookie流前置位于UNKNOWN显式恢复之前。原统一错误没有完整stack，故不把推断deadline写成原始exception，也不据此认定后台04da回归。首失败保留；后继最小场景修复/兼容重验、main与用户发布仍未完成。

## 已批准：最小旧consumer与新Web artifact实际

**状态：APPROVED（固定7272旧消费者最小源码/必要局部及固定新Web artifact实际；不包含新pair浏览器兼容或部署）**

当前 Review target commit：d736547e1bd5a7acc256dd0c4c863d5a2bbe2fb6。范围：apps/web/src/plugin-integration/attachments.tsx、apps/web/src/plugin-integration/session.ts、docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/oldconsumer-material.test.ts。

[固定源码与actual](../../docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/README.md)：精确patch落地，affected noEmit0/单case actual0、首resolverFAIL保留，6165ms CLOSED及完整清理。经[root集中独立审查](../../docs/evidence/wpf-release01/recovery-cookie/oldconsumer-checks/root-source-local-review.json)APPROVED，0blocking；两产品hash802e/728a与35原件固定相符。新Web artifact现已实际生成并完整归还；[原件](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/README.md)已获[Root实际独审APPROVED](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/root-actual-review.json)。新pair兼容/用户部署未执行。

[两产品主线核对](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/product-main-observation.json)确认main729d已含membership窄修，session保留已审MSG设置接线；不覆盖main，不等于后继harness/compat/部署已接收。

## 本次调用器准备与artifact实际边界

[准备批准](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/root-preparation-approved.json)已关闭唯一cleanup目录身份P2；两定向helper实际通过。artifact fixed c231 /779a生成不改变以上d736产品审批范围，亦不等于新pair compatibility。原builder/工具链/输入与outer actual0/完整RETURN由[本次原件](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/index.json)固定，[Root实际独审](../../docs/evidence/wpf-release01/recovery-cookie/web-artifact-first/root-actual-review.json)APPROVED、0blocking，仅此固定artifact/完整RETURN，不扩大产品scope。

## 历史：8964后继两harness限定批准

**状态：APPROVED（仅固定源码与必要strict/noEmit；浏览器兼容未运行）**

Review target commit：8964dc1185f62ed8934c15416e9798929359ab89

范围：apps/web/test/web-release-compatibility.fixture.ts、apps/web/test/web-release-compatibility.browser.ts。

[固定源码与输入](../../docs/evidence/wpf-release01/recovery-cookie/source-manifest.json)、[接口/生命周期差量](../../docs/evidence/wpf-release01/recovery-cookie/README.md)及[必要局部提案](../../docs/evidence/wpf-release01/recovery-cookie/local-check-proposal.json)与[strict实际](../../docs/evidence/wpf-release01/recovery-cookie/strict-actual/README.md)经[root独立审查](../../docs/evidence/wpf-release01/recovery-cookie/root-source-local-review.json)正式 APPROVED_SCOPED_SOURCE_AND_NECESSARY_TYPES_ONLY，0 findings。旧三份兼容证据不迁移到后继新后台；修正后台descriptor已供给，仅newWeb descriptor尚缺。browser/immutable compatibility NOT_RUN，新主线接收及用户可见发布未完成。

当前供给政策：[请求](../../docs/evidence/wpf-release01/recovery-cookie/supply-request.json)已绑定04da/CD27后台descriptor及[Original固定产物限定审](../../docs/evidence/wpf-release01/recovery-cookie/backend-cd27-supply/independent-result-review.json)。[Root静态移植批准](../../docs/evidence/wpf-release01/recovery-cookie/backend-cd27-supply/minimal-transplant-root-review.json)支持精确7272两file准备；oldconsumer实际/新Web artifact/新paircompat仍未验。8964本页批准仍只覆盖两harness/strict，不迁移为新pair运行批准；newWeb descriptor继续NULL。后台factoryCalls=0，不含SVC09A hostmain246ed，不冒PROCESS T7/用户部署。

## 历史：9658 三保留 App 兼容性批准及 main 接收

**状态：APPROVED（固定两harness与三App实际兼容；非个人部署或新backend验收）**

Review target commit：9658a6b763de69038778de1b0c16de64ff824c75

范围：apps/web/test/web-release-compatibility.fixture.ts、apps/web/test/web-release-compatibility.browser.ts；实际封存c06fa79c931998eb03a9d04d441681767fd796bf。

[Root独立实际原件](../../docs/evidence/wpf-release01/fixed-origin/main-close/independent-actual-review.json)核源码、raw/seal、三App各四观察及独立Cookie/CSRF、真实退出/EOF/markedDB/HTTP/Chrome/scratch/admin清理，0finding。原c2 FAILED410、syntax47、c3 PASS23495分层不改。[Lead主线接收](../../docs/evidence/wpf-release01/fixed-origin/main-close/receipt.json)与[188后继blob核对](../../docs/evidence/wpf-release01/fixed-origin/main-close/verification.json)固定main e0295747200d7f0616779a712fdfd06691c3708f；组合noEmit0/1321ms，无兼容重跑。

限制：仅backend6c/artifact7d1/policy81a8；旧App原生Bearer与独立Cookie证据分开，format1无releaseId不补造。无个人安装/部署、provider、后继lateLogout、全局OS egress隔离或新截图验收。

## 历史7805限定批准（不迁移到后继）

历史原件[previous-review](../../docs/evidence/wpf-release01/fixed-origin/previous-review.md)逐字保存，target7805b7dd20b1dda1b24ecb7497b1fca84bc5a63b、mainc450事实不改。

## 历史 c1 caller候选（现被c2修复准备替代；三App仍NOT_RUN）

[准备稿](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/README.md)与[固定父/worker/inputs/deps](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/source-pins.json)位于独立TMP；本页9658两harness批准不迁移为caller或运行批准。新review需覆盖deferred proxy launch/close握手、native外层sandbox差异、partial startup清理、未知DB保留与outer实际退出/唯一seal合同。已审30asset原件只作输入，不反复验证或伪造actual。

## 历史 c2 caller：source修复与小额actual（独审前）

[c1独审](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/c1-root-review.json)的REL-C1-R1/P1通过实际目录identity守卫修复；REL-C1-R2/P2将独立boss池计入12连接上限。[c2源与check](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/source-pins.json)固定，三个真实helper场景3/3/outer0/ownedTMP absent；不等于caller native授权或三App通过。现9658源码与strict原批准保留不重跑；c2父/worker/final native需root集中delta审。

## 历史 c2 caller：限定集中独审已通过

[c2独审原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/c2-root-review.json)与[native精确接受](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/c2-native-boundary.json)绑定933c记录/parent3a9d/worker5800、71输入与14manifest；两finding CLOSED、0blocking。3helper实际/outer0/244ms/精确TMP absent已核。9658两harness及旧strict审查不变。批准仅准备源与这次局部实际，不给三App/Cookie/PG/Chrome通过或运行许可，不给6c缺失的lateLogout修复背书；后续metadata HEAD由TMP正常绑定，不追改历史审查target。

## 历史 c2 actual：原失败已独立接收

[c2首实际原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c2-first/README.md)固定1e5f/parent3a9d，outer1/worker65、410ms，sandbox规则编译拒绝发生于Node前；真实三App/Cookie尚未进入。源码审批与3helper实际接受不撤改，也不充当完整runtime通过。生成profile原文以sandbox.sb保留并由索引明确非metadata，不改proof parser或隐藏后缀。无第二次运行。

## 历史 c3：单点修正（集中审前）

[c2 actual独审](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/c2-first-root-review.json)接受410ms失败/真实cleanup；c3仅host字面改localhost，实际生成profile的true检查exit0/47ms，见[c3原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/index.json)。9658两harness与既有strict/source批准不变；c3父需新的精确native绑定，3App仍NOT_RUN。作者不以局部语法通过批准完整网络/数据库/Chrome边界。

## 历史 c3 精确准备已接受（actual前）

[c3集中审](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/c3-root-review.json)核一literal/9规则/47ms syntax实际、0blocking；[native精确接受](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/c3-native-boundary.json)仅parent2500/worker5800与既定权限，不是三App通过。旧c2失败归因及cleanup接受保持，固定9658两harness/strict与当前实际分层。

## 历史 c3 actual PASS（独立证据审前）

[65原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c3-actual/index.json)及[限定结果与清理](../../docs/evidence/wpf-release01/fixed-origin/caller-c3-actual/README.md)：真实outer0/23,495ms、3App各4观察/3compat IDs、独立Cookie probe；完整marked DB/HTTP/Chrome/PGID/scratch/admin清理。作者仅报告实际，不自行批准独立review。原源码/准备批准与失败不改，主线/部署仍未接收。

2026-10-07T16:40:47.350Z：诊断字节计数单行差量已按实际saveJson格式修正；原compact计量历史保候选before，父/worker不变，集中复审待回。
