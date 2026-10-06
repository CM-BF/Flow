# 缺失regular-file stdio对照：最小v3设计（未实施、无运行授权）

当前输入为已固定v2结果 `6b397a584e5b221c63153f843014d31c4118d011`：一次编译、控制socket报告完整、同profile socket目标SIGABRT/no report、regular-file未运行。旧结果/raw/manifest/input保持原commit快照；本设计属于独立后继准备，不改变旧窗口或把当前metadata冒充旧archive hash。沿本地find-skills→clean-code（sickn33固定bdacd76）/codebase-design方法，保留现有模块边界与单一顺序执行器。

## 最小矩阵与可判别结果

只申请一次编译、最多两个合成目标；不再重复已知失败的profile/socket目标。

| 顺序 | 固定调用与stdio | 证据与门禁 |
| --- | --- | --- |
| compile | 原clang/source/profile/toolchain，save-temps=obj | 原始两流先0600/wx/fsync留证；健康、固定命令/owned输出和预算完整才继续 |
| control-socket | 本次唯一binary，无sandbox，三个pipe | 同nonce/PID五记录，三个fd必须socket且fstat/fcntl成功，作为本次binary/报告链控制 |
| profile-regular | 原sandbox/profile/空白名单环境，本次binary，三个自有0600 O_EXCL/O_NOFOLLOW O_RDWR文件fd | 同报告格式；可观察三个fd是否regular、各自fstat/fcntl返回及即时errno。保留有效负结果，不能把测量完成当操作成功 |

候选仅改变固定矩阵顺序/数量与所选stdio；C、report schema、SBPL、command生命周期、R06、网络/Mach/HOME/Keychain授权全部逐字冻结。self state三个文件用既有owned descriptor登记/finally关闭与精确root inventory，不增加允许路径或任意参数入口。

如果regular目标报告完整，可对照本次socket control和历史profile/socket失败，但只能陈述观察关联；不证明stdio是旧SIGABRT根因或某条Seatbelt规则。若regular也SIGABRT且无报告，只能证明此变体仍未取得测量。任何结果都不证明Node/Codex启动、provider或access:none。

## 已知诊断失败与未知执行的区别

本矩阵将缺失对照直接置于第二项，所以无需引入“失败后继续”状态机。compile/control失败停止；最后regular目标若明确nonzero/signal且直属进程close、group gone、fd关闭、roots可清理，记录“目标失败、资源已确认”，不将其永久阻止另一个以后获准的不同实验。任何spawn/close/group/inventory/persistence未知均停止并明确保留身份，不能继续、重试或重置clock。没有第三项入口。valid report中的负errno属于测量数据；与无报告/执行未知分开，CLI/结论不混称隔离通过。

## 最小实施范围与零运行验证

待Mika批准本设计后，现scope内只需host.mjs固定两case选择、execute-reviewed.mjs的v3输入/专用参数、host.test.ts直接消费者；必要时report测试补regular断言，但parser语义不变。command.mjs、C/profile/schema、R06不改。新fd-canary-v3 input/manifest/README独立绑定新target；旧v2目录不覆盖。不引入可配置矩阵或另一supervisor。

纯fake child/临时文件检查：socket控制失败不启动B；控制成功后B仅收到三个自有regular fd；B成功/有效负报告/明确SIGABRT/close未知各自安全结论；父fd finally关闭、unknown root保留；最多1 compile+2 targets先预约；receipt/CLI超界拒绝；原compiler logging/lexer作为直接消费者选必要项。Node24惰性import和语法检查仍0compile/0targets；不重跑PG/Web/R0631child或原目录检查。

## 时钟、字节和交付

未来候选仍总60秒、2MiB，60秒从入口固定hash前到全部自动runtime证据持久化/清理/CLI写回；不得把后续人工review、Git或异步整理声称纳入runtime时长。原流、slots、batch-result自动留证；把任何新增机器必需清单放同一入口时钟内。人工review归档在运行外，实际bytes另列并占预留tail；将两种时间口径在最终收据明确区分。

新input必须重新实量prepared bytes；capture、raw磁盘副本、可见中间产物、报告、runtime receipt/CLI分别计量，继续32KiB收据与128KiB尾部预留。v2旧tail130152B仅绑定6b snapshot，不复用为新运行余量；新归档选择必要固定输入/结果与简明metadata，先核足够尾部余量再提交候选。原未知系统IO边界保留，不宣称全系统计量。

当前仅设计：新增compile0、target0、运行授权NONE。Mika先审设计，必要最小delta完成后独立固定源码审查，再申请新的GO窗口；本提案不直接授权实施或执行。
