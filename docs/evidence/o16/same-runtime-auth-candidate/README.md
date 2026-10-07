# R3 后继：同原生版本与私有环境的公开认证状态

当前只读候选，未执行。R3原件固定8e56205b，实际SDK累计3/无第四次；本方案不改变费用许可或旧FAIL/KEEP，也不追认前两次的原因。

## 固定差异与能证明的范围

| 输入 | 历史公开状态 | R3 实际 query |
| --- | --- | --- |
| 原生二进制 | 2.1.291 / 9a1d2ed6… | SDK0.3.290内2.1.290 / b8412a38… |
| HOME/config | 真实HOME，未指定私有config | 私有HOME/config/tmp，recipe411 |
| 默认凭据命名空间 | 历史status仅报告claude.ai/Pro | 显式空CLAUDE_SECURESTORAGE_CONFIG_DIR保default Keychain service；文件fallback仍到私有HOME/.claude |
| SDK环境补充 | 普通CLI入口 | sdk.mjs另外补ENTRYPOINT=sdk-ts、SDK_VERSION=0.3.290、SDK_READS_SESSION_STATE=1，并删除NODE_OPTIONS/debug |
| 结果 | loggedIn=true，仅当时状态 | frame3 assistant.error=authentication_failed，result success/isError；实际647B受限正文存在，正文不外发 |

固定native内公开 `auth status --json` 选择authStatus，而非login/logout/query分支；函数根据已解析token/key来源形成loggedIn，再只渲染JSON。存在性不验证API端接受或有效期。caller只可保留loggedIn/authMethod/apiProvider/subscriptionType四白名单字段；email/org/config路径/全部原始输出及其hash不落盘。原647B诊断的result是34 UTF-8字节字符串、errors为null；分类仍依据SDK结构枚举，不用正文模式推认证源。

证据在[readonly-inputs](readonly-inputs.json)：固定二进制字节区间/authStatus与token-presence、storage namespace，以及SDK实际env增补接缝。不是仅在binary里搜到变量名就声称实际采用。R3未捕获完整child环境，SDK trace等动态补充未观测；本候选只复现明确固定的公开环境与无trace入口，不伪造历史环境快照。

## 最小待安排的一次入口

1. 在现own evidence增加一个薄caller，复用原 `native-stages/auth-status-once.py` 的白名单提取函数与固定OPS14监督；不修改已审产品，不新造监督器。SDK/native/Node/Python/OPS14由R3 preflight固定输入继承，运行前实际校验。输出新namespace `same-runtime-auth-once`，已有则NOT_RUN；旧R3目录绝不复用或修改。
2. 仅准备新的自有0700 phase root；直接复用已审nativeEnvironmentPolicy.prepare/environment得到相同recipe路径布局。单独列出固定SDK三个公开env增补；保USER/PATH及全部禁自动更新/非必要流量设置，不继承任何API/token/proxy/helper认证变量，不读取真实HOME/config或Keychain。prepare本身只做hash/私有目录，不import SDK/query。
3. 同一个固定SDK-native binary只运行一次 `auth status --json`，cwd也为新私有目录。没有prompt、stream-json query、模型目录、login/logout/setup、token导出或API fallback。此route只能观察相同二进制/公开env下的当前凭据来源存在性，不能证明query授权、刷新有效、模型资格或费用。
4. 建议本次完整有限段10s（含准备、TERM/reap/记录收尾），内存stdout+stderr合计64KiB，安全记录64KiB，私有初始化材料8MiB/最多128项；fresh至少1GiB+声明增量并计其它holder。复用OPS14 child新组与原deadline，不对默认Keychain/个人服务发信号。私有8MiB是有界测量/停止或KEEP条件，非OS磁盘quota或原子峰值承诺；共享认证正常refresh仍单列，不计8MiB，不承诺系统零写。若现port无法在该期限内闭合即NOT_RUN/UNKNOWN，不能扩大为通用框架。
5. 白名单结果与首失败/cleanup分别耐久后，只有直属组absent、双EOF、所有精确身份/uid/dev与无link特殊项核对通过才正常清理此新scratch；未知/越界KEEP。禁止修改R3 FAIL/KEEP。原raw只在内存解析，结束丢弃，不开全stderr。

当前未写caller、未创建新scratch/namespace、未启动认证状态子进程。由Lead确认本候选边界及本队local段后才固定薄caller并执行；普通准备不需要GO再授权模型预算。

## 解除条件与停止点

- 若status明确未登录：只证明该固定私有recipe下未检出可用来源；不推账户退出、不要求用户重新登录，也不读取/复制凭据补齐。下一步仅针对固定来源解析代码收窄差异。
- 若status明确已有登录：证明该状态resolver能见来源；仍不解除query gate，不把它等同实际SDK认证成功。保R3拒绝字段，进一步只读定位query与status路线差异。
- 若原始输出不可解析、超量、退出/清理未知：保存受控原因与所有权，停止，不换HOME/binary/环境反复尝试。

方法沿原find-skills/codebase-design/clean-code：职责只为固定route状态观察；复用原白名单/监督/环境policy，诊断、授权和执行分开。当前0测试/0SDK或auth进程/0query/0PG，正文与凭据不外发。
