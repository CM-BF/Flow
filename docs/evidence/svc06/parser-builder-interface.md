# SVC06 正式 parser / builder 接线

此片复用已审 `87dc292` 三个纯 Module，不扩大原纯选择器批准。当前源码准备固定，新增检查和真实产物尚未运行。

外部 `prepareBackendArtifact / verifyBackendArtifact / buildBackend` 签名与维护状态所有者不变。新的私有 `runtime-installation.mjs` 负责 staging 的读取、解析、投影和原文恢复；`build.mjs` 仍拥有 archive → clone → pnpm → inventory 的单条流程。运行宿主导入 builder 时不会加载 YAML，只有实际构建调用才惰性加载固定 `yaml@2.9.0` 的公开 `parseDocument / Document.toJS`。该包为 ISC、无依赖，作为根 build-only devDependency；runtime 选择仍只包含 server/runner 生产、optional 与根 tsx，YAML 不因此进入成品。

| 私有接口 | 不变量与失败 |
| --- | --- |
| `parseBuildYaml(text)` | ≤4MiB、YAML1.2/core、重复键/警告/未知tag/alias/多文档拒绝，精确2.9.0公开包身份 |
| `prepareRuntimeInstallation({root,seed,stage,pnpmVersion,host})` | 仅自己的 archive staging；所有锁 importer 原manifest有界读取；复用 runtimeDependencyPlan / installationView / runtimeCachePlan；必需index缺失在改投影前拒绝，不扫描整个seed |
| `clone-store.py seed target selected-cache.json` | 校验完整名单≤32MiB、≤200000条/6GiB逻辑，精确CAFS路径/bytes/内容SHA512/indexSHA256；只clone选择文件，目标nlink1且inode不同，无普通copy fallback；保留旧双参数tiny消费者 |
| `restoreRuntimeSource(prepared)` | pnpm frozen安装后的lock经同正式YAML解析转为JSON后复用语义校验；workspace manifests逐字未改；再恢复根manifest和lock原始字节，单列安装投影/来源摘要 |

正式安装参数直接消费已审 plan.installArguments，包括两个 `--filter-prod`、根flow、prod/optional、offline/frozen/ignore-scripts/ignore-pnpmfile/copy。只读Git archive仍保存原 apps/packages/tools布局、跨包导入和SQL；不手造node_modules、不使用共享可变store链接。选中CAFS的源与目标均完整校验，普通clone合法性与无外部hardlink仍由最终inventory保证。

主线固定输入 `7a7c3f4b214c41fb740c610d810f2fc5963d25b2` 的12行plugin-runtime锁增量已保留。owner树仍为历史功能分支，未假称其旧server/runner manifest与该新锁是完整运行组合。下一实际构建必须使用一个整体一致的固定Git target；源码源包/锁由该target的archive一起获得，不能取混合working-tree字节。本次正式parser依赖仅给当前构建工具使用，不改变构建目标的历史源码身份。

私有解析器安装另有一次固定入口与预算：[parser-install-manifest.json](parser-install-manifest.json)。先核官方metadata/SRI与233包文件，去重CAFS为232文件/730510B。私有 mini project、HOME/store/cache/config均在本树ignored namespace，禁止donor写入。安装期间8MiB是实际采样停止阈值而非空间预留；目录原子rename缺样显式计数，最终稳定采样不能缺样。alias存在不表示已可用，必须外层OPS14 exit0、完整EOF、整组absent且无failure。

新增局部验证准备：6个新用例覆盖正式解析、正确窄暂存/原字节恢复、缺index提前失败、投影/manifest变化拒绝、选中clone独立性及非法内容/链接/越界拒绝；1个原直接消费者只修缺缓存现在在安装前失败的断言。原纯选择器7例、旧保护/host矩阵不重跑。尚未运行，不能把toy staging称实际pnpm全闭包或成品启动成功。

完整准备≥2.5GiB且至少1GiB共享收尾余量不变，必须另固定源/输入并排独占运行窗口。真实filtered安装、SQL迁移/随机PG、SDK动态入口、延迟import与隔离开发树正例仍open；0provider/个人服务。本片没有新增部署权威或通用复制平台。

本段沿已安装 find-skills/codebase-design/clean-code/brainstorming：将原已批准设计落为小私有IO接缝、保留纯规则单源；当前原错误输出与unknown保留，空间估计和实际证明分开。官方来源：https://eemeli.org/yaml/ ，精确registry元数据保存在 parser-official-metadata.json；未安装技能。
