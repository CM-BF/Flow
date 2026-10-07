# Fixed startup controller — bounded diagnostic Interface

四产品固定 `f0e434bd04c496fbd60e8458c3f840f4d7b25e80`，已审并main `496b1d68caad14c7bc40a05b86b2136b12d68ca7`；唯一审查为 `docs/evidence/i02/svc09a-startup-controller-review.json`。loader独立固定 `c1e7ad8779d2d115cedeb5c0e29c76a5f5c95792`，本次仅导入/参数证据，实际宿主未启动。四产品写权于18:00:38.649Z原子归还，现claim v6仅own plan/evidence。

## Responsibility and evidence

`observeOwnedListener`以一次原ps/lsof判定返回受控结构；`ownsListener`直接投影owned布尔值。原waitReady消费这个结果，同时记录owner、listener及health/profile/webIdentity末次结果、轮次和monotonic耗时。10秒判定期限、50ms间隔、短路、信号、原UNKNOWN拒绝均保持。每角色只有固定谓词最后一项，最多四声明角色，没有无限事件列表。诊断写入state.startReadiness，原preserveStartupFailure在停止之前保存同一state；缺字段是无持久观察，不能证明阶段未发生。原Webidentity仍布尔，未声称其内部响应校验可归因。

健康响应只记录status/布尔与原allowlist的code或cause.code；不保存正文、message、stack、raw cause、URL、认证配置。非白名单和缺码仍STARTUP_UNCONFIRMED。此层只计controller ready耗时：旧wrapper load前置以及runtime两次inventory验证的逐阶段生产记录仍缺失，不能据新结果倒造R4原因。

`startPreviewServices`第五个可信函数port默认原statusPreview，普通调用行为保持。实际driver必须把该port显式绑定为2515原artifact.statusPreview；config的load、lock、status、stop也由原artifact公开出口执行。未改config.repository、assertInstallationSource或selected artifact身份规则。默认启动仍选择2515的runtime.entry及root启动服务；新controller不是新的服务runtime，也不是第二监督器。

## Exact module loading

权威 `controller-driver-inputs.json`：两新模块preview/process复制到自有exclusive shadow root；9个直接relative入口link指向固定2515产物。Node默认realpath解析使其传递闭包的16个未改工具模块全部来自该artifact，逐字对照Git098b；未用本WT旧base冒充产物。尤其本WT backend-release/files.mjs、index.mjs仍旧版本，明确排除。bare pg link来自该artifact，8.23.1的package、ESM与CJS入口均固定；完整依赖inventory继承已审产物，不称本轮重新hash363MB。

加载检查真实导入新controller和原artifact preview，核两者start函数不同及原公开四port存在；无I/O前置参数错误和exclusive namespace拒复用通过。新shadow仅2文件复制，其余精确links；收尾逐项核dev/ino/type后unlink或empty rmdir，不跟随link删除产物。settings codecs/tsx、Vite、yaml/build动态分支未选。没有完整clone/build/install，也没有SQL/HTTP/服务/provider。

## Scope and next consumer

本轮12选中=10新+2受影响旧startup，12/12；preview在检查后仅修一条注释，反替换精确重建原run pin，见controller-comment-delta.json。原empty-only wrapper exit1、23686B/3项tsx cache KEEP不改。后继实际Node导入1场景另通过，所有新shadow项/exact空scratch移除；两组均absent/双EOF，累计576ms/raw6536B。未重新运行旧33或任何真实host。

下一purpose仅默认center/legacy runner/Web start→empty tasks/attempts→stop。不得把loader通过视作实际可用，不进入settings/mixed/native query，不用未出现的八代进程作为清理事实。仍复用OPS14与原setup/clone/身份停止；新namespace、固定caller、实际窗口后才能运行。若只允许KEEP，必须另证实际已启动身份/组和连接收束；原完整8generation/mixed/DROP规则不变。

## Method

沿已记录find-skills发现本地codebase-design/clean-code/brainstorming：本片是Lead已选定的有界Interface修改，未新增安装。职责分别为一次监听事实、原控制循环的末次事实、固定装配；不复制生命周期或监督器。交付复核命名、无额外probe、首错先于cleanup持久化、未知与零值分开、动态模块来源、常数大小诊断；实际验证范围如上，旧失败/R4底层原因UNKNOWN均保持。
