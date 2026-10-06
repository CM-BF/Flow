# 固定 native Codex 的一次目录观察（设计，NOT_OPEN）

沿 WPF-MATURE-02-03。本片只回答固定 Codex 0.154 native binary 能否在既定隔离边界完成握手和一页目录读取；Flow Node 宿主、Node synthetic canary、Codex native 是三种角色。旧 Node/OpenSSL 失败不是本片前置或结论。GO 已授权准备；实现、固定组合独审和 Mika 的精确 HEAD 单次 OPEN 尚未完成，当前目标/测试/监听/PG/provider 均 0。

## 固定输入与调用

[design-inputs.json](design-inputs.json)绑定本树 16 个只读输入与 native、宿主 Node、sandbox-exec、OS 元数据四个外部指纹。执行包另补实际宿主依赖，不沿用全部历史实验清单。native SHA `4f85982624b3898c8991cb80c0981b2aa71070e3537046c9a95950318a95afcc`；policy SHA `37023e6516aa4ef6552a720b7d08d27aadb48fc7947d36b414ebd5c329391213` 必须逐字不变。

固定 argv：`sandbox-exec -D ALLOW_ROOT=<own> -D DENY_ROOT=<own> -f <own/control/candidate.sb> <fixed-native> app-server --listen stdio://`。归档 provenance 证明此前执行过 0.154 帮助/生成 schema，但未找到帮助 stdout；[固定上游 cli/src/main.rs](https://github.com/openai/codex/blob/6b9826e3aa83b1a5947db50f4332cb9c65f1b340/codex-rs/cli/src/main.rs#L551)注册该参数，4766–4771 有同 argv 解析例。此为源码依据，不是本机启动或发布产物可复现证明。当前[官方 app-server 文档](https://learn.chatgpt.com/docs/app-server)仅补接口方向；[目录可来自 bundled 数据](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)不证明账号 entitlement。

复用原 R06 六 TS 原字节和 `node-rootliteral/loader.mjs`，只在宿主使用 Node24 transform-types/固定 resolver；不把 loader、NODE_* 或个人环境交给目标。R06 唯一持有 spawn、三根 stdio、JSONL、ID、握手、TERM/KILL；不调用旧 canary/分页 driver。policy 保持 deny network/Mach/fork/Users；native 父目录许可可能不足，失败合法，绝不补 grant。

## 一次协议与资源生命周期

1. 单时钟从入口固定输入 hash 之前开始，先以 wx 预约。mkdtemp 成功立即登记原路径/未知 identity，随后核真实路径、inode、0700；只有确认的自有目录可清。创建空 `state/{home,codex,tmp,cwd}` 与只读 control；不复制个人配置或读取账户。七个且仅七个 env：PATH=/usr/bin:/bin、HOME=own/home、CODEX_HOME=own/codex、TMPDIR=own/tmp、LANG=C、LC_ALL=C、TZ=UTC。
2. 全局 10s 前最多一次 R06 factory。固定 clientInfo，capabilities=null；自动 initialize→initialized 完成才 ready。frame=128KiB，inbound/outbound queue=256KiB、各最多8帧，pendingRequests=1、serverRequests=1；initialize/request 各最多10s并受全局截止约束。宿主1进程与最多1个 native 目标分别记账；sandbox-exec exec 属同一目标链，不调用 Node synthetic/编译器。
3. 从 factory 后只有一个 receive loop。最多8通知、累计 JSON 编码值≤128KiB；公开仅总数/固定分类，不归档通知参数或远端错误正文。任何 server-request、未知通知方法或超界立即调用同一 close，绝不 respond、dispatch、授权或查询 auth。初始通知允许表仅 `configWarning`、`deprecationNotice`；其正文不输出。正常 ready 后最多一次 `model/list`，精确 params `{cursor:null,limit:20,includeHidden:false}`；不发 thread/turn/account 请求。
4. 单页结果序列化≤128KiB、data≤20；复用 `catalog.mjs` 的完整字段校验，catch 只记有限错误码，不透传 AssertionError。nextCursor 非 null 仅记 partial，不分页。catalog、requested、account/actual 分开，accountAvailability/actualModel/effort/tier 一律 unknown。通过目录不签发 NativeWriteAuthority 或 >=Sol 实际模型资格。
5. 无论 ready/request 的结果如何，finally 都 await R06 close。这是 controlled close，不能写自然 EOF。记录 reason、confirmed-exited、exit/signal、childCloseObserved、streamEnded 各自事实；stderr 完整还需 !incomplete/!truncated/!observerFailed。直属 child 关闭不是全进程 writer fence；R06 无 process-group 观察，不伪填 groupGone。unconfirmed 保留全部已知根、退出宿主且明确目标 settlement unknown；不另起 supervisor 或重试。

## 字节、时间与保留物

45s 包括 hash、准备、一次目标、关闭、目录 inventory、私有留证、结果/fsync/CLI；全局35s强制进入 R06 close，terminate=1000ms/kill=1000ms，不延长计时。`/usr/bin/time -p`+UTC 外层覆盖宿主加载到退出；最后自动写后再门禁，物理 shell 完成仍由外部 tool receipt 确认。若 helper 已返回 unconfirmed，宿主只在安全 CLI write callback 后退出，不把自身退出升级为目标已关闭。

私有 stderr sink 同步收最多8KiB，复用 `retainPrivateText` wx/noFollow/0600/partial write/flush/close/identity；完整条件不满足仍保存已有 prefix 并标 incomplete。失败的私有副本身份不能被最终 receipt 失败抹掉，副本独立于目标根保留，独审后另做同 inode 删除。仅允许 owner/reviewer 有界诊断，公开不含原文、环境或私人路径。局部 `.gitignore` 精确排除本片私有 stderr/outer 文件，不碰 shared Git。

`raw≤1MiB` 是本片**实际留存材料**上限：prepared≤256KiB、单页材料≤128KiB、通知只计数、stderr captured+根原件+私有副本≤24KiB、receipt/CLI≤32KiB、outer capture+副本≤8KiB、人工 archive≤128KiB，剩余留作有限 overhead；最终逐项实算，prepared/archive互斥，删除不冲减已计写入。R06 不提供累计 stdout wire 字节；frame/queue 仅峰值限制，报告 `stdoutWireBytes=null`，绝不声称整个 wire 输出≤1MiB。

ownTMP 上限8MiB同时检查 logical 和 allocated（blocks×512），覆盖两个本次 roots 的全部内容（含目录/control/profile/state）；每250ms及各阶段/关闭后做有界 nofollow inventory（最多512项、深度8，symlink/未知类型/inode改变即 unknown 停止）。超界立即 close；轮询不是硬磁盘配额、未观察的写删峰值未知。清理前必须 childCloseObserved、streamEnded 且 confirmed-exited、宿主 sink FD closed、根同 inode；任何资源 identity/inventory/close 未知保留精确已知路径，retained 完整性单列，不输出目录内容。自动扫描只触本次两个随机 own roots。nested目录枚举前后及递归完成时复核dev/ino与非symlink；这仍不是面对并发恶意替换者的race-proof文件系统隔离，未观察竞争保持限制。

## 精确实现范围与零目标验证

新实验目录仅 `probe.mjs`（消费/own roots/有限记录）、`execute-reviewed.mjs`（指纹/预约/固定参数/CLI）、`execute-window.sh`（既有 time+UTC 方式）、`probe.test.ts`与其单文件Vitest config；新 evidence 保存设计/inputs/固定 packet/局部 ignore。不改 R06/loader/catalog/policy/private-text 和其他任务源码。复用其现接口，不串接多个旧 runner。

必要 fake 覆盖：exact argv/env/一次握手与一次请求、partial 不分页、server-request/未知通知立即 close、bad page/timeout 最终 close、child/stream unknown 保根、mkdtemp后身份失败、stderr partial+最终persist失败仍保 identity、inventory 超界/未知停止。fake transport 不调用 R06 factory，0子进程/监听；惰性 import 另核 0factory。执行小检查前向 Mika 给出单文件/1worker/native configLoader、raw≤16KiB/cache≤32MiB与 fresh≥1GiB+32MiB门槛；不与 CORE/他队实际窗口争用，尚未执行。

方法：本地 find-skills / openai-docs / brainstorming / clean-code（既定 sickn33 bdacd76 方法基线，不安装）；固定来源优先于当前 docs，未知保持未知。clean-code 检查单一进程 owner、固定 recipe、错误不泄露/不丢资源、没有第二 FSM；本设计不是 source approval 或运行 receipt。

设计7e9bd5b2已获Mika/root 17:17:20 UTC只读APPROVED，16repo+4external+2archived无差异；实现只纳pendingRequests=1与双root全量计量收紧。此处实现仍未验证/未独审，实际NOT_OPEN。固定窗口字面go-native-catalog-probe-once。caller不发turn/auth/login/推理请求；native自身外网尝试/账单未经观察保持unknown，不由deny配置推0。

源码checkpoint包含薄caller/entry/outer与12项fake用例，检查PENDING；末次result部分写失败返回safe result与该descriptor身份，CLI另判post-persistence字节/时间。fingerprint直接复用原node-rootliteral inert entry的具名函数（它仅静态加载原loader；旧host动态执行分支不会进入），不复制transport或拉入旧canarydriver。
