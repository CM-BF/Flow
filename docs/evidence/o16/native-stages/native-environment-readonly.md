# O16-06 既有登录与一次性 SDK 环境候选

本段只读准备，原分阶段实现已由唯一独审批准并受控进入 main `d022c800`。普通 adapter、原16分轮检查、旧26与两次零模型旅程均不改。当前真实 native 入口仍拒绝，用户 JSON 不能自行解除。旧 FAIL/KEEP 资源未读取、移动或删除。

## 当前实际事实

[固定公开输入](native-environment-inputs.json)分开绑定本机 CLI 与 SDK：PATH 原有 `~/.local/bin/claude` 指向原生2.1.291，SHA `9a1d2ed6…`；实验固定 SDK0.3.290 默认 `dq()` 根据 darwin/arm64 选择其 optional package 内原生2.1.290，SHA `b8412a38…`。两入口不是同一个二进制，也未把普通 CLI 状态提升为 SDK 实际消费、模型资格或网络许可。

按 Lead 单次授权，使用[薄 caller](auth-status-once.py)与原 OPS14 对既有 CLI 执行一次 `auth status --json`。官方[CLI reference](https://code.claude.com/docs/en/cli-reference)与本机内嵌 `authStatus` 公开实现均核对为查询状态而非登录/query入口。固定命令的 JSON 在内存解析，除四个批准字段以外全部丢弃，stdout/stderr、email/org/token或其摘要均未归档。[结果](auth-status-once/result.json)：loggedIn=true、authMethod=claude.ai、apiProvider=firstParty、subscriptionType=pro；exit0，总359ms，owned absent/双EOF/无signals；[清理](auth-status-once/cleanup.json)在白名单结果持久后只移除空的exact自有scratch。环境只传HOME/USER/PATH/LANG/LC_ALL和自有TMPDIR，关闭自动更新/非必要遥测；未传数据库或provider credential变量。无query、SDK进程、交互登录、个人服务。

之前系统 Python3.9.6 导入 OPS14 的联合类型时 TypeError，发生在 reservation和child之前；[原失败](auth-status-preflight-failure.json)保留。随后按Lead授权改为已装固定Python3.13，只完成上述唯一实际status；不是两次auth，也不将前置失败当未登录。仅命令公开状态的只读语义成立，不由此承诺 native全初始化没有任何辅助写入。没有读取/复制私人配置文件或导出钥匙串内容。

## SDK 进程消费契约与剩余写入

| 位置/责任 | 已核固定事实 | 本候选的处理与限制 |
| --- | --- | --- |
| SDK JS env | sdk.d.ts与sdk.mjs明确options.env替换子进程env；普通claude.ts nativeEnvironment只传有限名单 | 保普通adapter不变；实验装饰口可显式构造env，不依靠父进程隐式继承，不放入DB/runner secrets |
| SDK native选择 | `dq()` 实际可解析0.3.290 darwin-arm64安装入口；未 import/query | 未来固定显式pathToClaudeCodeExecutable或核同默认解析，拒静默转到PATH的2.1.291 |
| 会话/恢复 | persistSession:false→`--no-session-persistence`；SessionStore需本地写镜像 | 现实验装饰器已关闭transcript并在query前拒resume/continue/store/fork；普通会话保持true；不复制SessionStore/transcript |
| 配置与临时文件 | 原生 `CLAUDE_CONFIG_DIR`、HOME及临时目录影响文件位置；debug可由SDK父进程环境开启 | 候选私有HOME/config/TMPDIR/CLAUDE_TMPDIR；在SDK import前去除debug变量。settingSources:[]仅设置发现，不能据此声称全写入禁止 |
| 默认钥匙串namespace | SDK**原生二进制**内`Jb()/VN()`直接读`CLAUDE_SECURESTORAGE_CONFIG_DIR`；显式空值保default service namespace，文件fallback仍取私有HOME/.claude | 这是已安装代码支持的候选分离接缝，不再仅引用SessionStore复制逻辑；普通adapter未透传该变量，实验可在最后query options.env中加入。当前CLI仅证明claude.ai登录，不证明凭据实际来自钥匙串还是文件fallback |
| 认证存储更新 | 同固定native代码有read/readAsync及update/delete，update调用security add-generic-password，delete独立；本段未调用这些内部入口 | 分离namespace不等于只读。现输入没有证明真实query/刷新不会写共享钥匙串，也没有已验证只读auth port；不能把此写入排除后还宣称原8MiB覆盖总写入 |
| 其它SDK/managed写入 | O10旧成功有managed插件/技能；SDK debug/cache、原生配置/认证刷新是独立写入面 | O10仅历史。私有目录可用原计量/监督观察，但不承诺原子峰值、所有逃逸写入或任意managed副作用已隔离；不为了准备另造沙箱/认证代理 |

公开环境变量的此前**名称存在性**检查未见ANTHROPIC_API_KEY/AUTH_TOKEN/BASE_URL、CLAUDE_CODE_OAUTH_TOKEN/CONFIG_DIR、proxy/cert/debug入口；未读取其值。这只适用于当时tool shell，不代替将来operator输入核验。当前CLI订阅不证明模型身份、可用额度、无回退或一次plan实际费用。

## 可交给 Root 绑定预算的最窄执行候选

复用已main原operator/driver/phase-host/query装饰器和SDK唯一iterator。第一阶段只允许1个planner query，收到实际proposal后关闭已登记runner/SDK/center/pool，保存原proposal/profile/source与资源关闭的15分钟pause；owner随后根据**实际proposal**单独确认两children范围和新预算。没有等待用户期间存活的SDK/连接。后继children至多2入口，独立接受仍为后一步，禁止一次许可包办完整语义旅程。

候选环境仅需原scope `phase-host.mjs` 与 `query-run.mjs` 一个显式实验env传递接缝及其直接测试；原operator/stage-policy只有固定授权材料校验需要时才扩同scope，不改普通adapter、不改领域/DDL、不引入第二loop。非秘密输入应绑定：SDK/native字节、来源类型、私有目录dev/ino、env**名字**、认证读写选择、禁止恢复选项、允许工具/profile、query数量/美元上限、总时间/写入/结束条件。不是另一个用户可构造的“authenticated:true”许可。

现有首段候选仍沿120s work+30s cleanup/150s独立deadline、raw2MiB/private8MiB、PG单列与现场并行预算；新模型费用上限必须由Root依据实际profile确定。硬门槛尚有一个具体环境问题：默认钥匙串可读取的候选与共享认证更新并非同一承诺。若坚持全部认证只读，需要已支持且可验证的只读消费机制；若允许现有native正常刷新，必须明确该精确共享存储副作用/计量口径，而不是靠private HOME或persistSession:false掩盖。当前二者均未自行授权，native仍hard refuse；不新增token、不复制凭据、不运行setup-token/login，不通过多次auth/query碰运气。

本段已经把来源/可用SDK接缝和剩余写入定位到固定代码，不再等待历史O10或重复目录模型发现。下一实作在上述明确选择后沿两实验源推进；不会将CLI四字段当解除全部native gate的证据。

## 方法与检查范围

复用已安装find-skills、codebase-design、clean-code（来源见原quality记录）：保一处实验环境接缝、显式输入、首错与cleanup分开；只记录公开字段且避免通用认证框架。0工程测试/PG/provider；本段实际只有一次公开状态子进程和已保存前置错误，不重复原16/26。最终元数据只进行自身status解析和固定字节核对。
