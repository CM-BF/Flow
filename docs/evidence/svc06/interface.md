# 固定后台产物 Interface（实施首片）

`prepareBackendArtifact({repository,target,directory,offlineStore,pnpmCli})` 从固定 Git object 输出 Flow 所需源码布局，用指定已安装 pnpm 9.15.4 在私有 staging 中 offline/frozen/ignore-scripts 安装。只有实际核验后原子发布；不启动任何服务。`directory` 为独立私有 artifact store，与个人服务无默认关联。

`verifyBackendArtifact({directory,artifact})` 接收 v1 opaque descriptor（artifactId/manifestDigest/sourceHead），核清单、文件 SHA/大小、内部相对链接、nlink=1、Node/非 system dylib 身份，返回可信 root/node。未知、超限、缺件或外链明确拒绝。源码/deps可脱离开发 checkout，但仍依赖固定 macOS/Node 动态库；不宣称独立 OS 镜像。

构建固定上限：单产物 1 GiB / 100000 entries，保留最多 2 产物 / 2 GiB；临时 seed store 上限 6 GiB / 200000 files。根据现有逻辑 525,513,738 B / 29,906 文件及 cache 4,103,511,954 B / 176,596 文件选择，完整逻辑字节/数量将随测量原始记录固定。预算满额拒绝，不删除 active/unknown 产物。失败先写 outcome 记录成功才清理 staging；记录失败则保留待核，不操作已有 PID。

host 后继仅增加显式 backend descriptor：bootstrap 前准备和校验、同维护 operation 保存、refresh 停止前再次校验，所有 center/runner/Web wrapper 与 tsx/SQL 从固定 root 加载；resume 核固定 artifact。legacy 未选择 artifact 的行为保持。身份、DB、配置、Web pointer/retained 与维护状态仍由既有模块持有。准备/发布不授权 drain 或真实个人操作。

构建期缓存采用系统 Python/clonefile(2) 独立 CoW 文件，nlink=1；Node24 FICLONE_FORCE 实际 ENOSYS 和普通复制 ENOSPC 原失败保留。clone 不支持拒绝，不普通复制 fallback。构建前至少 2.5 GiB 可用：最多约 1.5 GiB 新 physical 数据/元数据估计 + 至少 1 GiB 给 DB/其他任务；这只是检查，不是空间预留，后续 ENOSPC 仍失败保留事实。完整 clone 第二次实验 pnpm exit 1，原 installer stdout 未捕获，不能证明具体错误。依据 pinned pnpm 的 store/v3 布局修正实现后，空 cache 检查实际证明离线拒绝和原始 stdout 持久保存；完整成功仍未验。
