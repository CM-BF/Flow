# SVC06 有界闭包选择 / 暂存配置 Interface

本后继保持 `prepareBackendArtifact / verifyBackendArtifact` 外部 Interface、旧 builder/host/FSM 不变；新增三个私有纯 Module。未修改原 manifest/lock，无生产 YAML 依赖，无安装、clone、真实 full build、PG/provider 或个人操作。原6d276保护片 main批准不扩到这里。

| Module | Interface 与职责 | 界限 / 状态 |
| --- | --- | --- |
| dependency-plan.mjs | `runtimeDependencyPlan({lock,manifests,host,pnpmVersion})` → 确切 importer/snapshot/cache index身份、两份安装投影对象、确定性摘要与pnpm候选参数 | 只接已可靠解析的固定 pnpm9 lock对象；4 MiB输入、≤4096每表、≤64 workspace、≤32768图边；不读取文件/执行安装 |
| installation-view.mjs | `installationView(plan)` → 两份 staging文本；`verifyInstallationView(plan,view)` → true或拒绝 | JSON是可供 YAML parser读取的安装锁表示；只移根tsx从dev到dependencies，不裁整锁。不写正式源；字节总和≤4 MiB；后续安装前后语义摘要必须一致 |
| cache-plan.mjs | `runtimeCachePlan(plan,indexes)` → 所需 CAFS index/content路径、逻辑字节 | indexes为选中索引的原JSON文本。按 tarball SHA512与name/version核身份；完整peer快照不按name合并，重复包内容按CAFS身份去重、保留-exec；缺索引/路径/size冲突拒绝。32 MiB索引总量、每个≤2 MiB、沿旧seed条目/6 GiB逻辑预算。没有文件存在/内容哈希/物理峰值证明 |

实际选择根：apps/server+apps/runner生产和可选依赖，通过 `link:` 只到树内已锁且同名 workspace；显式根tsx。保留完整resolved peer key，不自行求解peer版本。平台不兼容仅在optional边可略过，required不兼容拒绝。包 engines 的实际可用性仍归固定pnpm安装与真实入口检查，不能用选择通过冒充。未知lock特性/非registry解析/不同工具版本拒绝，不写解析器/安装器。

后续唯一 builder seam：受控导入正式公开 YAML parse → 同纯plan → 仅选中cache读取并核内容/clone → 私有pnpm frozen/offline/prod/optional安装 → 核投影未变 → 恢复原源码manifest/lock字节 → 现完整inventory与入口检查。pnpm仍布局/peer/平台和安装者，SQL/SDK完整资源通过原Git archive层级保留。当前没有将这些待做步骤接入builder。

正式 YAML 工具依赖由F01持有根manifest/lock；现场无独立yaml包，不能加载任意路径/从pnpm bundle提取/偷偷借Ruby作生产parser。固定锁观察只用系统Ruby2.6.10/Psych3.1.0 safe_load、禁gems/禁alias的测试转换，读后复核原锁字节；不成为runtime依赖。缺正式parser不是退回全Web安装的许可。

`--filter-prod=@flow/server... --filter-prod=@flow/runner... --filter=flow --prod --config.optional=true`仅候选安装配置；真实filtered安装尚未执行。原 pnpm9.15.4身份固定，sourceLockDigest与installationSemanticDigest不同概念；尚无安装锁的真实pnpm接受证明。

性能证据限纯选择数量/本地测试时长；不能报告磁盘节省或startup收益。完整准备≥2.5 GiB并共享收尾≥1 GiB不变，cache逻辑字节不用于降门槛。新功能只具备小fixture与fixed-lock选择证据，SVC06-03/04/05保持open。
