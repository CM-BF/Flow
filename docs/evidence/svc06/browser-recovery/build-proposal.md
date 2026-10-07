# SVC06B 固定后台构建准备

状态：准备完成，真实build/install/import未运行，等待唯一独审与实际共享重窗口。固定产物source `04da80692e79e2b7c3f6341c7fa76515a3f719a3`，父 `6c0fdcda8858aac33489c48c1948e902dd6a3d7e`。新artifact ID未知；旧7d1保持原样。

仅组合已审66ca/main7272的三browser-session leaf；第四个cleanup支持文件保持原字节，供原专测解析使用。实际builder只归档apps/packages/tools及包元数据，故不把docs支持文件列为产物内测试可运行证明。依赖、host工具tsx/pg/Vite、271 snapshots/7 importers、33 SQL、其余72个受审源输入逐字不变。Recovery新网页正在原owner处修正候选，本构建不预先绑定其未审产物。

## 唯一执行入口

在此worktree根目录，仅在Lead明确实际窗口且fresh准入通过后执行：

```text
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/opt/python@3.13/bin/python3.13 docs/evidence/svc06/browser-recovery/build-supervise.py --execute-fixed-build
```

监督器以wx/0600独占创建本目录 `outer-report.json`，再由固定OPS14监督一个新session。Node实际参数为本目录 `build-entry.mjs --execute-fixed-build`，cwd为本树根。入口以独占mkdir创建 `actual-first`，artifact根只由 `/private/tmp/flow-svc06b-artifact-` 新0700目录产生；任一已存在/未知命名空间都拒绝，不换名自动重试。pnpm/clone仍在该组；无detached服务、PG、Chrome或provider。

`build-inputs.json`只记录原40316B inputs的Git出处、bytes/hash及新source/tree/archive、三文件附加断言、三个固定方法身份。薄入口先核原JSON完整bytes/hash，再仅替换上述来源字段；运行reservation持久化派生input的SHA，派生input另含原JSON SHA和delta SHA。原72 source/17 runtime、缓存选择、资源门不减。原build源码/OPS14/内部加载proof沿固定路径引用，不复制原大清单。

复用entry只新增`runFixedArtifact(inputBytes, options)`与纯选项规范化：options限evidenceDirectory/temporaryPrefix/runtimeProof。默认CLI仍读取原inputs、原路径与原错误停止逻辑；import零I/O。resource-stop保留`process.exit(75)`，监控失败由外部OPS14停止/收尾本组，fsync不延迟停止决定。旧树和已消费旧run不改。

## 时间、空间与保留

- 原420s work + .5s TERM + 2s reap；builder原clone/install各180s不放宽，内部解析15s不放宽。
- 新增规划2,317,352,960B：stage安装/最终artifact文件上限1GiB，selected seed512MiB、pnpm私有home/cache128MiB、source archive32MiB、metadata512MiB、raw2MiB。stage→final为原同卷rename，安装/最终不是两份复制；seed/home/metadata/原件在同时存在口径内。现新archive998文件/7,837,984Blogical不代表physical。
- 最低fresh取原2.5GiB、3,927,965,696B（上述增量+1GiB收尾+512MiB协调余量）、以及执行时团队全部KEEP/并发声明所要求floor三者最大。准备阶段不占窗口，不能把历史floor当执行事实。live1GiB与采样global可用空间下降上限保持；500ms采样不声称硬physical peak。
- raw总2MiB，OPS14外层capture1MiB，原build-record/import输出边界不变。完整outer原始Report直接持久化0600，服务停止决策发生在持久化之前。失败/unknown保留本次root/原record，不清旧资源或自动重试；成功artifact保留供Web兼容。

## 已有和新增证据

`source.json`引用原域独审和三前像/四后像；不重跑原4PG/types。`preparation-facts.json`只读核271 index/2,252,500B及17固定runtime相符，缓存payload未重新hash，原3 mode差异保持历史；实际clone仍逐原/目标内容检查。

`validation-01.json`为本次唯一local运行原件：4个不同例通过，默认路径/新namespace、import零I/O、重复reservation不覆盖、实际input+严格argv加载。目录内fixture在既定scratch内，资源group absent/双EOF、同身份空scratch清理；没有调用builder、安装、factory或SDK。Python调用组装已AST解析。实际build及artifact内部加载仍NOT_RUN。

本次clean-code复核：复用原安装与监督职责；新薄入口只组装固定输入，无第二状态机/监督循环，无参数从环境绕过固定source。source与artifact分开，真实Web兼容/个人发布仍由原owner及后继门禁完成。
