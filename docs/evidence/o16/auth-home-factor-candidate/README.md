# O16：固定原生版本的 HOME 可见性对照候选

当前仅公开源码定位与薄 caller 准备，**NOT_READY / 未执行认证状态**。本段实际开始 2026-10-08T00:47:28.671Z，公开二进制读取于 00:54:08.755298Z 关闭。原三次 SDK query、账户费用 UNKNOWN、FAIL、record loss 和全部 KEEP 不变；本候选不授予第四次 query。

## 本次确定的启动写入边界

[唯一来源记录](startup-write-boundary.json)列 18 个公开字节区间/哈希，引用总长 25,520 B，没有复制二进制或原文。旧三片段重新核同；233 MB native 的全量 SHA 继承原绑定，不声称本段重新全量核验。发现过程中有同名 minified 函数，不用未解析的名字命中推断认证行为。

`auth status` 注册经 `withStorageV5` 包装。Commander `preAction` 在该 action 前执行 `Frt/pYt` 及 `$_r→H`，后者启动 `veo→ea/bX/wl` 正常刷新检查；`veo` 的 promise 以 catch 接入，可能与 status 重叠。`createSubcommandRoot→hws→fFe` 是终端根创建，不能替代前述初始化。不能把仅看 `fe` 的读操作理解为整个命令没有写入。

| 可达分支 | 公开源码确定的路径/动作 | 限定 |
| --- | --- | --- |
| 配置初始化 | 显式 `CLAUDE_CONFIG_DIR` 决定 `we()`；`qgr()` 为该目录中的 `.claude{suffix}.json`。`tro/Rnt` 可能持久 firstStart/machineID；`veo` 可能更新账户元数据。 | A/B 继续固定同一私有配置目录；未读取实际配置。 |
| 正常 OAuth 刷新 | 空 secure override 下 `Jb()=HOME/.claude`。`wl` 根据过期、refreshToken、scope 等条件决定是否 mkdir；随后 `.oauth_refresh.lock`、`realpath(Jb)+'.lock'`，以及 `Wp/Xl` 的 owner 元数据。 | owner 文件的具体 basename 尚未展开；刷新是否触发、实际账户条件均 UNKNOWN。 |
| 凭据 mutation | `nco` 在 `Jb` 下建 `.storage-write` 锁；正常原生 Keychain update 可更新默认 service。 | 只属于同账户正常原生认证流程，caller 不读/复制/导出内容；不新增 login/logout/API 路线。 |
| 文件回退 | storage fallback 可在 `Jb/.credentials.json` 写入或删除；主存储成功时也可能清除回退文件。 | 这是原生实现的条件能力，不是本次已发生事实，也不授权 caller 手工操作此文件。 |

已定位 HOME 相关的认证辅助写入，但**没有证明全启动链只会写这些位置**：`H` 还调 managed settings、动态事件记录/telemetry 与条件 scratchpad 初始化；这些内部写入的完整路径及异步退出收束未在本有界段全部追踪。默认系统 Keychain 的实际文件写路径也不由此 caller 控制。必要同账户刷新已有授权；其它未明确的 HOME 辅助写入仍待 Lead 对具体候选边界裁定。8 MiB 只可用于新自有私有目录，不能覆盖或承诺共享 HOME/Keychain 总写入量，也不是 OS quota。

## 唯一最小对照

复用原 `nativeEnvironmentPolicy`、固定四字段 parser 和 OPS14；不改 SDK/native、环境 policy 或监督器。一个新运行 namespace 下，准备一次新的 private HOME/config/tmp/cwd。A 使用 private HOME；B 仅将 HOME 替换为 `/Users/citrine`。二者启动前的 14 个显式环境键及值差集必须恰为 HOME；USER、空 secure override、三个 SDK 公开变量均保持。旧 `same-runtime-auth-once` 已消费，绝不复用。

两次命令均固定 `2.1.290 auth status --json`，无 prompt/query；最多 A/B 各一次，未知停止，不第三轮。原 stdout/stderr 只在内存内解析，既不落盘也不哈希；只保存 loggedIn/authMethod/apiProvider/subscriptionType 四个白名单值、缺项标记及原监督结构。subscriptionType 缺失不补 null/Pro。

源码 `fe` 明确 `process.exit(loggedIn ? 0 : 1)`。仅完整合法 false/none/firstParty + exit1，且所有权 absent、双 EOF、无 signal/secondary failure，允许解释为预期 negative status。若原 OPS14 first_failure 恰为该 exit1 派生的 CHILD_EXIT_NONZERO，原字段完整保留，不能改 exit0 或清失败。只有该条件性分支可容忍 subscriptionType 缺项为 UNKNOWN 后进入 B；必需字段缺失/非法、其它非零退出、超量/超时/权限/收尾未知均 STOP。

A/B 顺序及配置、Keychain 的共享可变状态会产生混杂：A 可能正常刷新后改变 B 的输入状态。即便静态环境只差 HOME，结果也只记录该次路线可见性，**不证明 HOME 为唯一原因、Keychain 成功、query 授权或模型资格**。原 2.1.291 的历史公开状态不充当 B。

## 尚需完成

薄纯策略与直接正反例准备后只做 0auth/0query 局部检查。实际双次入口须另固定一次 namespace、真实 runtime/policy/parser/OPS14 pins、环境差集、有限期限及新私有资源上限；由 Lead 对正常 HOME 初始化未知项与实际资源窗口给出具体边界。当前未创建运行目录、未加载 SDK/native、未读取真实 HOME/config/Keychain，未运行任何新认证命令。

方法沿本地 find-skills/codebase-design/clean-code：只给现 caller 的公开结果解释与环境差集一个小 Interface，不造新监督器或凭据代理；安全点复查保首错/缺项、单份来源与授权分离。
