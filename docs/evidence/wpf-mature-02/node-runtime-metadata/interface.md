# 固定运行库元数据对照

WPF-MATURE-02-03；chatui01_owner / gpt-6-astra，co-lead mika。2026-10-06 13:57:28 UTC。GO授权准备 `go-node-runtime-metadata-once`；**实际 NOT_OPEN**。本片只检验一个精确策略候选，旧cause 9605封存结果不改，不由宿主能解析libuv推断旧失败原因。

## 固定策略差异

[path-closure.json](path-closure.json)从既有bootstrap清单62项排除Codex项，逐组件lstat/readlink推导61个Node运行库种子；44项解析成功，17个系统库独立文件ENOENT（不证明缓存存在）。共144个实际组件观察、27个symlink，保留别名、中间链接、真实路径与必要父目录，形成177个精确literal。未readdir/glob递归扫描运行库或私人目录。[derive-policy.py](derive-policy.py)可审派生过程；首次准备因系统Python不支持realpath strict参数在写产物前停止，修复后完成一次派生，0目标。

[新candidate](../../../../experiments/codex-app-server-conformance/node-runtime-metadata/candidate.sb)完整保留旧node-rootliteral profile 6401B前缀，只追加一个177-literal `file-read-metadata file-test-existence`规则，16762B / SHA37023e6516aa4ef6552a720b7d08d27aadb48fc7947d36b414ebd5c329391213。无新增read-data/map/exec、subpath、网络、Mach、sysctl或私人路径权限；旧文件/进程/网络限制原样。重复的叶节点metadata不扩大其旧read*范围，显式test-existence仍按新授权记录。根已有read/test不重复加入。每个新增literal都是种子或已观察链接目标的组件前缀，绝不泛化到同目录其他项。

libuv观察链为opt/libuv→Cellar/libuv/1.52.1及libuv.1.dylib→libuv.1.0.0.dylib；这只支持对照价值，不证明哪次检查被拒。实际门禁重新核固定binary/依赖hash和所有节点kind/链接target/已记录absent状态，任何漂移停止，不即时重新生成或放宽profile。原System shared-cache grant保留，并非本片新增。

## 两槽与单一资源owner

| 固定槽 | 复用Module与资格 | 输出/停止语义 |
| --- | --- | --- |
| 1 immediate-exit | 既有runCause / runOwnedCommand，新增固定recipe选择新profile；同Node24、flags、env和脚本；仍detached own group、不发initialize | 真实exit7、signal null、stderr精确40B及旧hash、stdout实际0B、双EOF/child/group/清理/计量完整才进入2；旧loader observationComplete不作成功条件 |
| 2 owned-canary | 既有Node batch新增固定single-canary recipe→compose→只读R06；同peer normal/preload和7断言；仅本槽创建一个自有随机loopback listener | 必须原7项报告、ready身份、无额外request、close.reason=CLOSED/child确认、stderr完整0B、listener closed且accept=0、inventory及清理完整；失败/unknown立刻停止 |

原默认cause与三槽入口语义保留。新枚举不可接受任意profile路径或命令。Node batch由stage语义选择sandbox/期望/182B，不沿用index0的无sandbox分支。新profile16762B略超旧copy16KiB，**仅此固定profile**复制上限32KiB；其他文件上限不变，所有实际复制计账。R06、peer、preload不写；使用既有六模块固定loader与内建transform，目标不继承宿主loader/NODE环境。

槽1统计原始chunk observedBytes（包括首次越限和停止期间）及实际磁盘副本；截断/EOF不全则UNKNOWN。槽2只有严格完整正常路径才允许固定peer两帧**182B保守源码上界**入账，明确非wire计数；PROTOCOL/LIMIT/WRITE_FAILED/异常退出、报告缺失或任一正常资格缺失则stdout资格UNKNOWN，不能由空inbox/queue推0B。若此条件不成立，即使可见总额小也不声称2MiB完整证明。无需新增R06 observer或第二stdout consumer。

## 时间、预算与最小接线

新薄组合entry只顺序调用两Module，不管理第二套child；两个slot各wx持久预约后才调用factory，失败不进入下一槽、不恢复额度。目标≤2、compile/Codex/SDK/provider/auth=0。统一performance起点覆盖hash→全部自动收据/清理/CLI；槽1启动≤20s、自身完成≤30s，槽2仅全局<45s且余量充分启动，全部≤60s。既有 `/usr/bin/time -p` + UTC/外部tool完成回执覆盖真正宿主exit；末次自动写后再取门禁时间，不能将较早快照称全程。

2MiB总账只计prepared一次；slot1实际observed+disk+receipts、slot2captured+disk+合格182bound+receipts、outer捕获及保存副本、CLI与人工archive逐项合并。候选分配prepared≤512KiB、archive128KiB、全部机器收据CLI32KiB、outer8KiB；剩余1368KiB供两槽捕获和私有文件，提前保留首次越限及收尾空间。两个旧helper的reserve不是实际bytes，不双加prepared/reserve，不重复加captured副本；每个磁盘复制另计。entry生成自动inventory，未确认资源保留精确身份；收到明确close前不删私有root。人工review/Git在60s外，但实际archive仍计总额；组合固定时需≥24KiB archive余量，当前还未声称prepared已定。

最小源码delta：cause host固定recipe/严格control资格；Node host固定single-canary recipe/成功路径stdout资格；compose固定profile枚举及此profile复制限制；新薄entry/outer与有限Reason解析器。既有command/生产R06冻结。直接pure反例覆盖1+1 factory、第一槽失败0第二槽、sandbox选择、未知close/额外stdout失格、part-write/overflow计账和旧默认；新Reason与精确policy差异检查；Node24惰性import=0factory/0listener。不重跑旧窗口/全套/PG。

## 受控Reason观察

私有stderr完整捕获后、finally删除前，仅保留有限类别/operation、显式文本errno与固定public token role；不返回PID/path/raw/env。新增小解析器供新recipe使用，旧cause输出合同保留。依据[Apple当前Loader.cpp](https://raw.githubusercontent.com/apple-oss-distributions/dyld/main/dyld/Loader.cpp)：1055–1076为搜索阶段missing/not-file/sandbox-stat/protected-override/errno，1422–1429为stat，1598–1607为mmap。类别不推断未打印的errno；不同尝试可并列、矛盾标冲突、未知格式保持UNKNOWN。仅当前主源语法依据，不是本机dyld构建或此次因果证明；无系统日志/历史crash读取。

方法：本地find-skills发现并复用clean-code固定sickn33@bdacd76、codebase-design、brainstorming；本片为已授权有界对照。集中生命周期与预算owner、固定recipe而非通用矩阵、错误/未知不回填成功。读取规则与技能不扩大授权。13:55 fresh claim0dd v5七scope；Data available1367680KiB，仅小文件准备、无安装。原sealed archive继续按历史Git解释，当前metadata是新阶段。
