# X01 静态安装材料与真实 loader 首片

2026-10-06 12:51:36 UTC。Lead 已授八个精确leaf，writer6ddedc73 v2已原子amend成功；[receipt](leaf-amend-receipt.json)。沿原X01、[AGENTS modular-design](../../../AGENTS.md#modular-design) 与已审纵向/依赖设计，不新父计划。先固定正式 `@flow/plugin-runtime` manifest，根export `./src/package-store.ts`、tar精确7.5.22。F01负责server/runner workspace依赖和lock importer/受控offline install；不触个人Flow node_modules，不借私有依赖路径。

## 两个 Module

`prepareInstalledPackage({ artifact, tarballPath, store, signal })` / `readInstalledPackage({ artifact, store, signal })` 隐藏压缩/格式/磁盘复杂度。artifact只保留X04已有不可变字段的结构化投影（artifactId/name/version/bytes/sha256/integrity），调用者从真实receipt取值；tarballPath/store.root仅受信宿主本地配置。store含稳定storeId、绝对own root、operator允许的artifact SHA256集合。返回安装receipt与仅宿主使用的entrypoint定位；receipt不是中心installed/enabled/callable状态，中心操作/refs后继负责。

包格式首片：真实npm `package/` 前缀，严格有限 regular files，无任何link/device、路径别名或重复；package.json精确name/version/type=module、无scripts/任何依赖。`flow-plugin.json`声明schemaVersion=1、hostApiMajor=1、kind=tool、唯一.mjs entrypoint。不执行pack/install hooks。压缩8MiB，own gunzip全部展开（含header/meta/padding）1MiB，CRC/流结尾确认后才交公共tar.Parser；禁止ignored/meta/二次压缩整包，不能通过entry累计冒充展开总量。文件最多16、每个256KiB，两个JSON各16KiB，path240 UTF8 bytes。解析器只承担TAR语法；Flow负责拒绝/预算/安全落盘。只支持明确定义的self-owned fixture子集，不冒称任意npm包兼容。

完整解析/静态验证后，在own root内mkdtemp登记身份，文件wx/no-follow、有限receipt、文件/目录持久化、原子rename发布。内容/receipt精确相同时重读幂等，不重跑代码；不同或损坏现存安装拒绝，不覆盖。中止/错误统一close own资源；全部settled且staging身份仍相同时才删除本次staging，否则有限UNKNOWN含retained identity。rename后的结果不确定不删除发布树，不假称未安装；read可重新验证。read校验精确artifact、receipt/树清单/hash、无新增/缺失文件，固定受信store，不扫描猜测恢复。trusted同机目录假设不等对抗同UID恶意替换的OS隔离。

runner host只提供 `invokeInstalledTool` 小入口：受信store+中心未来冻结binding（本片仅结构参数，不自授权）和有界文本/config、signal/所有权检查，read验证后真正dynamic import包entrypoint，再验证hostAPI/tool导出并await invoke。调用者提供现有权威动作授权与ownership检查，错误不吞；没有默认allow。operator digest allowlist必需，未知包拒绝。输入/配置/输出各16KiB；取消是协作取消，已调用后无法确认结束是unknown，不声称强停。无缓存第二版本指针/自选latest/状态机；installed、loaded和callable仍分开。

## 验证 / 范围

只测这两个真实公开seam：真实自有tarball/文件系统、真实import/invoke，先meaningful red再实现，保留断言。覆盖完整成功/replay/restart read、hash/CRC/全展开padding/meta/类型/路径/重复拒绝、篡改/多文件、取消/清理不确定；loader no-grant/unknown digest、正确输出、输出限额、ownership/包错误、取消。测试不mock loader；资源故障可窄spy Node own IO，finally恢复。不启动PG/provider/实际runner负载/外部registry。公共public install→task→artifact链仍待Lead shared合同/DDL，不能把本片检查称完整vertical。

技能：沿已读本地find-skills、brainstorming已审设计、codebase-design和clean-code固定bdacd76；新增读取本地tdd SKILL，已授权seam与验证要求不重复用户确认。tar7.5.22固定源码/README只读输入沿installation-dependency-addendum；默认整个展开缓冲1MiB限制内，避免多层stream接线复杂度。架构新增共享文件材料Module与runner loader；main尚无本片，图基线后继由Lead更新。

2026-10-06 13:08:15 UTC 实施收束：上述leaf已实现待独审，最终边界见[检查](leaf-checks.json)。额外明确TAR必须有Parser确认的EOF，尾部仅零padding；新包只支持所述有限self-owned格式，不泛称所有npm tarball兼容。无新的公开Flow wire contract或global mount。

**ESM生命周期**：固定安装版本→规范稳定file URL；invocationId不得放URL的query/fragment，禁止cache-busting和删除require.cache冒充回收。disable拒新binding或删除安装材料均不等同于进程内模块卸载；旧已加载namespace可以存活。真实同版本复用/不同版本身份仅局部模块证据，常驻多版本loaded数量上限及安全回收继续X01-04/10，尚未实现，不另建缓存状态权威。[固定官方Node24.20.0依据](https://raw.githubusercontent.com/nodejs/node/v24.20.0/doc/api/esm.md)。
