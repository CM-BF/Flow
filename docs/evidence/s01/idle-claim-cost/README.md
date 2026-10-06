# S01 idle-claim-cost 准备

当前是源码准备，**NOT_OPEN / NOT_RUN / 未独审**。不运行本目录说明中的命令；fake 检查与一次真实 loopback 探针都须 Mika 在固定源码 review 后分别开放。没有 PG、SDK、模型、安装或生产修改。本片沿 S01-06；唯一状态为 [S01 status](../../../../plans/s01-runner-capacity/status.md)。

固定输入 `8d84d529a0756116bd0fc8bad969d61a6c26248e`，完整 literal 与 SHA/bytes 见 [source-supply-request.json](source-supply-request.json)。Lead sole Git operator 供应 `source-snapshot/`；owner 不导出 Git 源、不覆盖旧工作树产品源码。57 TS 283197B 加4metadata1431B，共284628B，计入未来2MiB实验输入预算。既有 Node/Vitest/zod 安装只读且不复制，不把其整个安装体积声称为本次新增数据。

本准备前 HEAD `7fd60892e2c4e8d5e6a7ea88d205d1c07a5a9859`；claim `508f9c85-a27c-4382-bfe9-caca43be4b0e` v2 ACTIVE/5 scope，[COMMITTED receipt](claim-amend-receipt.json)。旧 A/B / 128 raw 与所有历史 manifest 不变；未知旧 journal 完全禁止访问。

## 实验 Interface

唯一 workload：公开 `runRunner`，1 runtime、capacity1、active attempts0、至多12个空 claim，保持生产默认500ms等待与1500ms请求超时。动态 loopback listener 仅返回 `{assignment:null,remainingLeaseMs:0}`，第12个已接收请求正常 stop 后仍给明确响应，等待原 claim drain 和持久 `inFlight=null/assignments=[]`。不缩短 poll、不修改 journal、durability 或 recovery。直接 import 镜像 runtime，不 import runner index/SDK，也不导入整 shutdown/capacity 测试。

观察器只包装私有 journal 的 open/rename，以及所返回 FileHandle 的 writeFile/sync/close；未观察方法、receiver、返回 Promise、错误对象保留。记录 issued/succeeded/failed 与有限轨迹，首次预期 ENOENT 原样保留。截断标 unknown，累计计数仍继续，不能把失败操作或截断记录删掉。writeInputBytes 是调用参数字节（包括失败尝试），不是内核或磁盘写量；只从成功 directory.sync 记录 durable phase。begin 后未发 HTTP 的停止也可能写一对，HTTP 与 phase 分开核对。

有界数据：最多256 API轨迹、64私有handle、24durable phase、12 HTTP记录、16notice、4并存socket。不得输出 token/header/journal UUID/正文。未知错误仅有限分类，不打印原 Error.message。

## 计时、计量与关闭

15s从外壳计时开始，前10s允许工作，之后仅原请求排空/关闭/计量/证据；case接收同一绝对起点，不在运行停止时重置期限。case绿只证明内部行为；完整 Vitest 退出、最终cache目录、raw、清理和外部shell wall必须单列收据。薄外壳已准备，完整镜像已供应，全组合审查仍待完成，**目前不能执行 actual**。

2MiB包括实际镜像输入、准备文件、raw/CLI/receipt和ownTMP；reserve128KiB给有界raw，journal尝试写入累计额外保守计入，ownTMP同时报logical与allocated样本最大值，取较大者。运行中采样不是硬文件系统quota，样本间cache峰值UNKNOWN；最终退出后的完整own目录计数是另一事实。不得用删除文件冲减累计journal charges，也不声称计量全部OS/安装模块加载I/O。若无法证实门禁则 UNKNOWN，不启动第二次。

Node24 `NODE_DISABLE_COMPILE_CACHE=1`、不设置 `NODE_COMPILE_CACHE`；定向 plain Vitest4 config 禁用fsModuleCache/cache与dependency optimizer，cacheDir/TMPDIR仅own root。工具仍可能产生少量临时文件，实际峰值未测。源码镜像/准备资料亦计2MiB，不能用“仅raw”漏掉它们。

正常清理必须在 owned runtime、listener、socket、Vitest进程组均确认关闭后。私有journal unknown/进程关闭unknown则保留root identity；Promise超时不是OS取消证明。内部case仅保留新root至外壳确认进程退出，不自行清除未知状态。绝不清理其他任务或历史root。

## 实现位置与复用结论

`experiments/runner-capacity/mixed/idle-claim-observer.ts` 隐藏有限的FileHandle观察/还原；budget文件仅本实验的输入/样本/原始期限核对；两个fake测试文件现9组草稿，0运行。actual单项与定向config是同一直接消费者；execute-idle.mjs 仅拥有这一个 Vitest 进程组，13s TERM / 14s KILL / 14.3s关闭观察、剩余预算作清理/证据，0执行。正常case仍10s停止新工作，原已发请求独立deadline排空。Lead专门目录已供应，owner获明确授权后按61 literal复制并逐hash复核，0import/check。

已读 mixed/process.ts 与 ../processes.ts：前者固定 fork旧child.ts +tsx +IPC配置，后者同样固定旧child与IPC停机，直接复用会导入原PG/runner场景及原合同，且没有Vitest子进程组/最终cache计量接口。本片保留它们原样，仅准备此实验的薄外壳，不制造共享supervisor框架。

## 验证与方法

9 fake groups计划覆盖 this/Promise/error透明性、非目标路径、failed write bytes、初次ENOENT、轨迹上限、还原未知、固定时间/byte预算。actual单项的12HTTP、24durable phase与实际sync次数逐项核，不能用公式替代观测。检查均 NOT_RUN，不能沿用旧 A/B 的64通过。

本地 find-skills → clean-code（sickn33 固定 bdacd76）+codebase-design/brainstorming；2026-10-06 18:36:05 UTC 安全点静态自审：观察器只负责精确私有API计数，预算只负责固定输入/时间/byte门禁，停止/排空继续由公开runtime负责。已修正失败write也应计尝试字节、轨迹溢出仍保留issued计数；未执行验证，类型/实际透传仍待有界fake检查。无新技能安装。新源码批准不会自动开放实际窗口。

18:38:51 UTC architecture_read 对固定73157915的observer/budget及9fake草稿完成限定SOURCE_REVIEW，无P1/P2、VALIDATION_PENDING；0执行。非阻断成功open/rename Promise identity与receiver断言已在原首case补充，无新增重复case。此静态意见不覆盖后加薄外壳，不是正式准备批准。

外壳保留所有预约/owned root identity；采样前与删除前核同dev/ino，只有确认runtime case通过且Vitest close/进程组gone/stdio end后删除自有root。异常时保留PID/root，超时不冒称取消。原始outer-result是PRE_FINAL_PERSISTENCE_SNAPSHOT，末次CLI才包含其写入与archive计数结果；最终Shell exit和完整wall仍必须外部收据确认，不能将snapshot或case通过升格整体PASS。CLI/raw截断、清理未知、窗口超限都不得启第二次。

Lead供给已接收：61文件284628B逐byte/hash与固定8d84请求一致；[operator receipt](source-supply-receipt.json) SHA a883dc915dce693fd1124c07c546e61049e5c0dcbe05e231acadf86247442653。仅从其专门sourceRoot复制，未自行Git物化。复制前free1575358464B；当时满足1GiB与小副本预留，此事实不授权后续运行或代替其fresh gate。

定向类型配置继承原root strict/noUnchecked/ES2023，pure仅4个本片文件；runtime另含actual入口及镜像传递闭包。@flow只指向固定镜像，vitest/zod/@types仅指向既有安装；没有SDK alias。全部检查NOT_RUN。实际窗口尚须固定input SHA、clean execution HEAD、ledger和独立review，以及外部Shell全过程time/退出/归档最终复核；环境OPEN变量不是自行发放权限。
