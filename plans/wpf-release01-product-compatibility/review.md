# WPF-RELEASE01 review

**状态：NOT_STARTED（新版 Cookie 后继固定源码；strict通过，浏览器未运行）**

Review target commit：8964dc1185f62ed8934c15416e9798929359ab89

范围：apps/web/test/web-release-compatibility.fixture.ts、apps/web/test/web-release-compatibility.browser.ts。

[固定源码与输入](../../docs/evidence/wpf-release01/recovery-cookie/source-manifest.json)、[接口/生命周期差量](../../docs/evidence/wpf-release01/recovery-cookie/README.md)及[必要局部提案](../../docs/evidence/wpf-release01/recovery-cookie/local-check-proposal.json)与[strict实际](../../docs/evidence/wpf-release01/recovery-cookie/strict-actual/README.md)交 root 集中独审。旧三份兼容证据不迁移到7272新后台；新descriptor尚未供给。作者不自行批准。

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
