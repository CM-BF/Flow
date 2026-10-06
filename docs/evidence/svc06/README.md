# SVC06 有界实现切片（完整构建仍受阻）

固定实现 `6d276baee6d3fbf14eb4b638a9ad773ffcec988d`，基线 `280289008a5a3779e4e5e6453181b96062ed9514`。作者 assignment_review / gpt-6-astra。只读独审尚未开始；本片不能据此发布到个人服务。

已实现 prepare/verify、精确 Git 树与离线安装策略、Node/非 system dylib 身份、字节和保留上限，以及已有维护流程中的显式 artifact 选择。源和依赖布局复杂度留在私有 artifact module；host 仍只有原 operation/drain/hold/refresh/resume 权威。当前实证只覆盖下表，完整固定产物、从产物启动及开发依赖消失后的延迟 import **未通过/未执行**。

## 检查与原始输出

| 场景 | 实际选择与结果 | 原始证据 |
| --- | --- | --- |
| 非固定 target、未知 descriptor 拒绝 | 1，不发布 | artifact-first-green.txt；artifact-red.txt 为缺模块的真实先红 |
| APFS clone 独立 inode/nlink=1，改 seed 后 clone 不变；已存在/符号源拒绝 | 2 | clone-final.txt；clone-check.txt 保留 Node FICLONE_FORCE ENOSYS |
| 上述三项再次组合 | 3（重复，不累加） | artifact-denials.txt |
| 空离线 cache 失败先保存 installer 输出再清 stage | 1，历史版本 `f500086b`；随后空间门槛已改变 | offline-denial.txt；最终 2.5 GiB 门槛下未重跑此项，不算最终代码完整套件通过 |
| 内容修改、外链、hardlink、Node 身份变化、超大 sparse 文件拒绝 | 2 | integrity-final.txt（最终 byte-budget 路径）；integrity.txt 为前轮重复 |
| 原 legacy 真实 center/runner/Web 启动/停止 | 1 selected，0 provider | legacy-preview.txt；只自己的随机安装/DB/PID，已清理 |
| 未验证 artifact 在 drain 前拒绝，原三个 PID/accepting 状态不变 | 1 selected，0 provider | preflight-host.txt；只自己的随机安装/DB/PID，已清理 |
| 最终所有变更 JS 语法 | 12 文件 exit 0，仅语法 | syntax-final.json |

合计 **8 个不同作者行为观察，分轮执行，其中空 cache 用例绑定历史较低空间门槛**。这不是最终源码一次 8/8；没有全库检查、模型调用或个人服务操作。`*-exit.json` 记录原执行状态；`artifact-red-exit.json` 明示来自当时工具回执转录，不伪装额外进程 stdout。

局部复跑从本 worktree 使用 `/opt/homebrew/opt/node@24/bin/node --test --test-name-pattern='<实际用例标题>' <精确 .test.mjs>`；legacy preview 与 maintenance 两项须将 stdout 先放 `/tmp`，因为它们要求 Git clean。空 cache 场景需要满足实际 2.5 GiB 空间门槛；当前未满足，不以跳过称通过。`pending-host-journey.mjs.txt` 是未运行的后继草稿（包括待复核清理逻辑），不属于生产源码或已验收测试。

## 失败与资源限制

1. 普通全 store 复制遇 ENOSPC，`build-first.txt` / `build-first-stage.json` 保存原失败与 stage outcome。未发布，自己的 stage 已清理。
2. clone 全 store 后 pnpm exit 1，`build-clone.txt` 保留。该次 installer stdout 未被原实现捕获；不能断言精确 pnpm 错误。随后只读核 pinned pnpm 会在 store-dir 下再用 `v3`，修正布局并在空 cache 检查中实际保存 ERR_PNPM_NO_OFFLINE_TARBALL。布局是推断的修复原因，仍待完整构建证明。
3. 当前保留 **fresh ≥ 2.5 GiB** 才可完整构建；1 GiB 给共享 DB/证据/其他任务，至多约 1.5 GiB 新产物和元数据的保守估计。它不是空间预留或峰值实测。clone 不支持/ENOSPC 失败，不普通复制 fallback、不自动重试。prepare/install timeout 为合作/子进程限制，不是全 API/文件系统硬期限。

`space-plan.json` 保留最初 1.25 GiB/Node FICLONE 候选历史，当前实际策略以 Interface 和固定源码为准。`old-install-cleanup.json` 记录唯一原 owner 的已结束 R05 node_modules 清理：实际只回收 9,834,496 B，不把 du 的 553748 KiB 当回收量；其源码/锁/证据和全局 store 未动。未扩大删除其他任务路径。

## 只读 narrowed seed 核算

`seed-closure-observation.json` 与 `seed-closure-plan.json`：fixed lock 有 683 个包 resolution；当前 Darwin arm64 581 个完整索引，26,549 个内容文件，合计 27,130 entries / 502,905,916 逻辑 B / 579,477,504 已报告分配 B。102 缺失全部在该 lock 声明的其他 OS/CPU；当前平台缺失 0。固定源码布局另有 792 文件 / 5,782,968 B。

方法来自本机 pinned pnpm 9.15.4 `dist/pnpm.cjs` 的 `getIndexFilePathInCafs/getFilePathByModeInCafs`：tarball SHA512→`files/xx/<hex>-index.json`；索引内 integrity→内容文件，执行 mode 使用 `-exec`。本次对生成 lock 的 packages 段作有界观察扫描，683 个 block 与 683 个 resolution 对齐；只核文件类型/大小，没有 hash 全内容、没有官方完整 YAML/平台解析或新的 install。后继正式实现须使用固定可靠解析并仍由真实 offline/frozen pnpm 验证，不能把此研究清单直接当成功产物。

缩小 seed 显著减少 clone 文件数，但 APFS metadata、安装临时峰值和并发磁盘使用未测；`allocated` 不代表新增物理峰值。普通复制 selected seed 本身还可能多需约 579 MB。**没有据此降低 2.5 GiB 门槛，也没有启动第三次完整构建。**

## 未验证/未知边界

- 完整 artifact 生成、固定入口运行、SQL/SDK 延迟 import、修改开发目录后隔离性与 pinned refresh/resume 正例，全部待资源恢复。
- 15/180 秒子进程超时不证明任意 FS/OS 操作硬有界；Node 与非 system dylib 仍是同机固定前置。
- 发布 rename 后失败可能已存在 artifact；已知 ID 随 outcome 保存。fsync 文件不等于目录/掉电持久性，未测 OS hardkill/断电。
- 保留上限拒绝新准备；没有自动垃圾回收或删除 active/unknown。遗留 stage/锁不自动抢占。
- 无 App 新兼容重验、无个人部署许可、无 provider。已有 Web pointer/retained compatibility gate 与旧 legacy 行为保留，但 pinned host 正例尚未证明。
