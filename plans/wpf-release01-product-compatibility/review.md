# WPF-RELEASE01 review

**状态：APPROVED（两harness源码与固定c2准备限定范围；真实三App兼容尚未执行）**

Review target commit：9658a6b763de69038778de1b0c16de64ff824c75

范围：本次fixed public origin / 三retained App successor两harness。f3d限定源码0blocking见[原件](../../docs/evidence/wpf-release01/fixed-origin/f3d-source-review.json)；9658 type-only delta见[独审](../../docs/evidence/wpf-release01/fixed-origin/types-first-root-review.json)。[必要复验独立接收](../../docs/evidence/wpf-release01/fixed-origin/types-second-root-review.json)核12raw/9pin/实际退出及清理。本次必要strict/noUnchecked/noEmit实际exit0，[原始结果](../../docs/evidence/wpf-release01/fixed-origin/types-second/result.json)；首f3d类型失败原样保留。源码批准与类型通过不等于真实兼容通过。最终backend tuple和公开设置已核齐；独立owned caller c2已通过集中delta审与精确native边界审；实际资源准入仍待管理者fresh，browser/PG/HTTP旅程NOT_RUN；c2首次actual在sandbox-exec阶段FAILED，见下方本次边界。

必须核：真实Chrome页面请求和Node APIRequestContext分离；exact proxy/Host与无fallback；原Bearer+独立Cookie补证；SSE与真实ACK prefix；原四观察与最终backend/context；owned cleanup、报告与未知失败。

## 历史7805限定批准（不迁移到后继）

历史原件[previous-review](../../docs/evidence/wpf-release01/fixed-origin/previous-review.md)逐字保存，target7805b7dd20b1dda1b24ecb7497b1fca84bc5a63b、mainc450事实不改。

## 历史 c1 caller候选（现被c2修复准备替代；三App仍NOT_RUN）

[准备稿](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/README.md)与[固定父/worker/inputs/deps](../../docs/evidence/wpf-release01/fixed-origin/caller-preparation/source-pins.json)位于独立TMP；本页9658两harness批准不迁移为caller或运行批准。新review需覆盖deferred proxy launch/close握手、native外层sandbox差异、partial startup清理、未知DB保留与outer实际退出/唯一seal合同。已审30asset原件只作输入，不反复验证或伪造actual。

## 历史 c2 caller：source修复与小额actual（独审前）

[c1独审](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/c1-root-review.json)的REL-C1-R1/P1通过实际目录identity守卫修复；REL-C1-R2/P2将独立boss池计入12连接上限。[c2源与check](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/source-pins.json)固定，三个真实helper场景3/3/outer0/ownedTMP absent；不等于caller native授权或三App通过。现9658源码与strict原批准保留不重跑；c2父/worker/final native需root集中delta审。

## 当前 c2 caller：限定集中独审已通过

[c2独审原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/c2-root-review.json)与[native精确接受](../../docs/evidence/wpf-release01/fixed-origin/caller-c2/c2-native-boundary.json)绑定933c记录/parent3a9d/worker5800、71输入与14manifest；两finding CLOSED、0blocking。3helper实际/outer0/244ms/精确TMP absent已核。9658两harness及旧strict审查不变。批准仅准备源与这次局部实际，不给三App/Cookie/PG/Chrome通过或运行许可，不给6c缺失的lateLogout修复背书；后续metadata HEAD由TMP正常绑定，不追改历史审查target。

## 历史 c2 actual：原失败已独立接收

[c2首实际原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c2-first/README.md)固定1e5f/parent3a9d，outer1/worker65、410ms，sandbox规则编译拒绝发生于Node前；真实三App/Cookie尚未进入。源码审批与3helper实际接受不撤改，也不充当完整runtime通过。生成profile原文以sandbox.sb保留并由索引明确非metadata，不改proof parser或隐藏后缀。无第二次运行。

## 当前 c3：单点修正待集中delta审

[c2 actual独审](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/c2-first-root-review.json)接受410ms失败/真实cleanup；c3仅host字面改localhost，实际生成profile的true检查exit0/47ms，见[c3原件](../../docs/evidence/wpf-release01/fixed-origin/caller-c3/index.json)。9658两harness与既有strict/source批准不变；c3父需新的精确native绑定，3App仍NOT_RUN。作者不以局部语法通过批准完整网络/数据库/Chrome边界。
