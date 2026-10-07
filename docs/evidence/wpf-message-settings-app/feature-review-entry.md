# MSG03 当前固定审查入口

当前实现 **fcf5e8c8335bf5de6fc3b7d74b5b2985d2e91f56**（产品成员投影修复 b92470377349dea17a12d0abc244f0fed7992e33），base **c13042ba7e74733d8c68cc05bd1b2d7cb5bbaa50**。唯一 WT `web-message-settings-app` / branch `codex/web-message-settings-app`；claim7e3f v3 exact20。原 WPF-MATURE-02 TODO11：**APPROVED_FOR_CONTROLLED_SOURCE_INTAKE_EXACT18；INTEGRATED 3c9345df4aec85a37e8a2a155e079db260d515b1**。

[18源manifest](source-manifest.json)是15产品+3test的固定范围；[main-intake](main-intake.json)列逐路径base预像、target Git blob/SHA256与集成限制。其余两个scope仅本计划/证据。Original合法接收见[main receipt](main-closeout-20261007/msg03-intake.json)与[18源核验](main-closeout-20261007/verification.json)；owner本次未改main、个人服务或共享合同。

## 实现与修复

App每view唯一C及opaque ownership，复用P01动作/context和官方Thread；Apply同步CAS。官方Send/detach前冻结A并换新稿ownership，材料await期间保留B，即使正文相同或只有设置不同。Send/Queue重试用原key/body；历史turn和Queue显示各自frozen requested。CompleteDraft/Recovery保完整设置及namespace边界，不另造store/FSM。

真实材料失败/取消通过公开composer port保护B；显式Restore绑定本次空目的地lease，而非永久绑定原send世代。只有完整恢复成功才释放held binding。共享附件修复让Recovery与Send复用同一draftItems：current优先held/inTransit，无端口时用既有restoredDraftIds保部分/完整已恢复A；输入移除不复活，未验证项有序，旧端口cleanup不清新端口。

## 源码和局部证据

- [9c46 source/local审](source-research/root-msg03-9c46-mounted-source-local-review-20261007.json)：旧17源码和6probe/types准备；历史9fc的11PASS/57未选保持其原绑定。
- [b924 source/local审](source-research/root-msg03-b924-membership-source-local-review-20261007.json)：两产品+1direct实际修复；[14原件](held-projection-local-20261007/manifest.json)，最终1PASS/68未选、affected noEmit0。d576初绿未覆盖unmount反例，b924修复后再验，历史不抹。
- [worker白名单/caller审](source-research/root-msg03-c4bee-browser-preparation-review-20261007.json)与[f05阶段准备审](source-research/root-msg03-membership-phase-preparation-review-20261007.json)：fcf5仅独立phase/旧账pin/run路径差量，原生命周期和业务断言保留。

## 两条真实mounted验收

| 固定执行与证据 | 实际范围 | 独立审查 |
| --- | --- | --- |
| dcdca6；[材料22原件](browser-attempts/membership-material/manifest.json) | cookieRead+messageSettingsMaterialReturn 2/2 PASS。failure：settings-only B界面/0chip/0命令，拒覆盖B再显式恢复A。cancel：durable B有序完整refs/IDs，真正late adapter settled后整份B仍相等、0A dispatch；清空/omit后完整A准确恢复，释放hold后不同材料可继续准备。success真实202冻结A保B；同document导航关闭旧opening。 | [W01业务328f](source-research/w01-msg03-membership-first-business-review-20261007.json)；[root生命周期5853](source-research/root-msg03-membership-material-lifecycle-review-20261007.json) |
| e96325；[设置24原件/双图](browser-attempts/membership-settings/manifest.json) | cookieRead+messageSettingsApp 2/2 PASS。首次P01/ApplyCancel回焦点、显式reauth/恢复0自动POST、冻结Send丢ACK原key/body重试、Queue B与live C分离/历史requested、真实主题按钮及390布局/180共前缀长名。 | [root生命周期/双图fc552](source-research/root-msg03-membership-settings-lifecycle-visual-review-20261007.json)；[W01业务5399](source-research/w01-msg03-membership-second-business-review-20261007.json) |

failure未单独序列化持久空B全量快照；cancel before/after完整IDB值由固定运行断言证明，原browser.json没有离线全量快照，不伪称离线再比较。材料中的完整A指该例text/settings/有序AttachmentItem，不替代其他profile/knowledge/steering全矩阵。原独立themes390组未选，第二selector内双主题检查和PNG真实执行；不冒全键盘/对比度/Arc验收。

两次outer/parent/worker/Chrome皆0、双EOF/drop0，DB marker/0conn普通DROP、fixtureclose、精确PID/PGID与scratch/env清理闭合；无独立portprobe。新120s阶段13353+13015=**26368ms**，未用93632封存，**CLOSED / NO_NEXT**。旧90s和local各phase均closed，余额不转。

## 历史失败与限制

[首](browser-attempts/material-first/manifest.json)、[第二](browser-attempts/material-second/manifest.json)、[第三](browser-attempts/material-third/manifest.json)、[第四](browser-attempts/material-fourth/manifest.json)全部FAIL原件不改。第三缺fixture graceful-close报告仍UNKNOWN；第四持久B混held A是真实P2，当前修复通过不回写旧失败。旧90s charge51110/38890封闭；局部20s14680/5320封闭。

[root最终组合审](source-research/root-msg03-final-scoped-intake-review-20261007.json)已批准精确18源受控接收、0blocking；合法main3c9345已核同接收，原六TODO完成。真实个人turnSettings目录由共享TODO08/11 owner发布，synthetic fixture目录不证明个人能力/provider/native/部署已可用。旧7272最小两文件[patch](held-draft-release-minimal.patch)是独立供给，不能整拷MSG session或继承此组合结果；Release最终backend由Original固定04da及其真实descriptor，须另核移植组合。

非阻断原视觉后继P3：390图scroll thumb靠近Speed右侧，未证pointer/keyboard失败，本批不改源码或重跑。[clean-code记录](quality.md)记录本段安全点。

第二业务审5399接受四次原key业务请求和真实ACK/replay、B/C当前与A历史。settings-only恢复实际为helper主动expireSessions后公开UI重新认证；不是正常cookie-only reload。390模型选择用selectOption，不冒全native键盘；两图属于所选App组，不冒独立themes390已跑。
