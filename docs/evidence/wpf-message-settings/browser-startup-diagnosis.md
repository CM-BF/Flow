# Settings browser first startup — bounded read-only diagnosis

固定封存478943c0ca5645a06feae46268ccd2e174789c7c；运行f800/f3。16个原件全部逐字/hash核符（105,282B），未改任何原件。只读现存raw/固定worker与supervisor；无Node/import/Chrome/HTTP/PG/资源采样、个人目录读取或项目写入。

## 已有实证

原chrome.log完整保留文件853B，共四行：两次Crashpad settings.dat `Operation not permitted (1)`；ProcessSingleton `Failed to create socket directory`；delegate明确`Aborting now to avoid profile corruption`。读取的是已封存日志，不访问日志指向的个人Library路径。worker:74–76将stdout/stderr合并并最多保64KiB；没有独立stderr文件、dropped计数、stream-close完成标记，所以只称“完整读取保留的853B”，不宣称已捕获操作系统全stderr。

owned-chrome.json明确worker87564、Chrome87566、profile `/private/tmp/message-settings-browser-candidate/scratch/chrome-BJP3HY`，继承worker进程组。worker结果于18:58:16.323Z保存failure `Owned Chrome exited before CDP readiness`，checks[]，fixtureClosed=true、chromeExited=true。父elapsed5197ms、exitCode1、groupAbsent/scratchAbsent=true、cleanup.errors[]。父1是Node worker状态，**Chrome原始exit code=NOT_CAPTURED、exit signal=NOT_CAPTURED**；不能从父值或chromeExited反推。worker:41只将二者折为布尔，:107/112–113只保存该布尔，没有exit/close事件或code/signal字段。Chrome自身终止先于CDP检查失败可由worker:80–81路径支持；最终cleanup没有记录每次signal发送，不能额外推定某个终止信号。

## 能重建的 argv / 环境 / sandbox

完整launcher argv见audit.json，由固定a051 worker:69–71 +实际owned profile +绑定Chrome路径确定重建；不是运行时argv快照。包含headless=new、no-first-run/no-default-browser-check、disable-background-networking/component-update/sync、remote-debugging-port=0、上述user-data-dir、其disk-cache子目录、about:blank。Chrome版本是binding中已pin的154.0.8037.98；内部子进程args没有捕获。

Supervisor:106–111对父环境过滤FLOW_/PG/POSTGRES_/DPERF04_/MESSAGE_SETTINGS_、DATABASE_URL/NODE_OPTIONS/proxy变量，再显式设TMPDIR/TMP/TEMP/XDG_CACHE_HOME/NODE_COMPILE_CACHE为 `/private/tmp/message-settings-browser-candidate/scratch`；其余已知override见audit。worker:30–31实际到Chrome前通过这些路径/禁cache断言。Chrome spawn不另给env，故继承worker环境。**MAC_CHROMIUM_TMPDIR没有显式设置或清除，原父继承环境未落盘；不能把“没有源码override”写成“实测该变量不存在”。** HOME未改且值未读，未读取任何凭据或进程环境。

原sandbox.sb415B：默认允许，deny file-write*；仅allow确切scratch、run输出 `/private/tmp/message-settings-browser-candidate/raw/settings-20261006-185753-21f4e5` 和/dev/null。网络deny仅放loopback bind/inbound/outbound。上述profile在已allow scratch内；这不证明Chrome内部所有native临时目录也选择该路径。未放行个人Library/系统tmp；失败后也未扩大sandbox。

## 因果边界与最窄后继建议

1. **路径候选，不伪造唯一根因。** root已独立查current Chromium primary并由manager转达：同报错在CreateUniqueTempDir失败/socket bind前；mac GetTempDir优先MAC_CHROMIUM_TMPDIR否则NSTemporaryDirectory。与本固定parent未显式override该变量相符，是强环境候选；本诊断未重复网页研究，且root说明154tag未到，原日志没有失败socket/temp实际路径、errno或Chrome code，不能宣称唯一证实。Crashpad拒写是并列实证，不据此断言其导致ProcessSingleton退出，不推断R01或其他runner必失败。后继若沿该方案，先在既有自有scratch下显式设置MAC_CHROMIUM_TMPDIR并核源码/身份，禁止放开整个系统tmp/个人Library、关闭sandbox或修改HOME；仍须新独审/准入，不能把这份建议当运行授权。
2. **补捕获，不能补写旧事实。** 最小worker delta：spawn后立即挂exit/close监听，分别保code/signal与是否自然ready前退出；记录经过白名单的launcher argv、已知临时目录override和profile，不能输出继承全env。保存stdout/stderr字节/是否截断，并有界等待close后flush；父仍只负责ownPGID，不把Nodecode当Chrome。原code/signal永久NOT_CAPTURED，不回填。
3. **Vite扫描是另一条已记录边界。** worker.log2649B另报assistant-ui/@flow/interaction等非本fixture直接图依赖；已审fixture root=apps/web、没有optimizeDeps.entries限定，不能据此需要扩大依赖安装，也不能断言它致Chrome原生退出。后继可单独审限定到现fixture入口的最小Vite扫描配置，保持实际四组断言与原raw；该修改尚未执行/运行。

技能方法沿已读find-skills/clean-code/webapp-testing：资源身份与证据字段分开、保原失败、未知明确。完整UI/390/键盘仍未进入验收，37direct无需重跑。共享window已归还Lead18:58:58，当前R01独占，不试启动。
