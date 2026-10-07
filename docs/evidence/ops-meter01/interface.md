# OPS-METER01 Interface — 2026-10-07

唯一职责：在调用方给出的真实目录与 dev/ino pin 下，返回有界、非原子的目录计量观察。模块不读取文件内容，不判断所有权、不删除、不管理进程/数据库，也不生成 source bindings、运行许可或资源 admission。

`measure(Root(path, device, inode), *, exclude=(), limits=Limits(max_entries, max_seconds, max_depth=64)) -> Measurement`。

- root 必须是 caller 固定的绝对规范实际目录路径；缺失、symlink、device/inode 不匹配均 unknown，不变成零。caller 自己决定尚未创建的目录何时开始采样。
- exclude 是最多128个无 `.`/`..`/空段的相对 literal 子树路径；不允许 root、绝对路径、重复或父子重复。仅当前同设备真实目录可以被排除；命中时不进入子树。既有调用方的 scratch 使用 `exclude=("scratch",)`，不做两次测量相减。
- 只累计 regular 文件的 `st_size` 与 `st_blocks * 512`，按路径计数，不去重 hardlink。目录元数据、symlink payload 不纳入这两个总数。symlink 计数明确返回、永不 follow；特殊文件、跨设备、类型或身份变化、读取错误均 unknown。complete 仅表示这个声明的 regular-file 观察口径完成，不代表无 symlink 或所有实际存储都已计入。
- entries 是实际枚举的子项数（含排除目录、链接和后来消失的项），directories 含 root。枚举后首次/复核 lstat ENOENT 单独计 vanished_entries；root 缺失、已打开目录断链或其他 I/O 不能借此吞掉。并发增长/消失允许被如实观察，不承诺原子 snapshot/峰值/物理可回收。
- 子目录以父 descriptor 相对打开，NOFOLLOW + directory + device/inode 复核；每层有界深度，退出时复核当前父路径仍绑定同目录。时间使用 monotonic，枚举/metadata I/O 前后检查，entries/depth 限额则 unknown。单个阻塞内核调用不能由本同步模块强制打断，调用方仍使用既有 OPS14 总期限；不复制监督循环。
- `Measurement.state` 为 complete 或 unknown；unknown 保留已观察部分数值、首个有限 `Issue(code, relative_path, errno)` 和计数。部分值不得当全树总量用于清理或 admission。两种状态都不授予删除权限。只保持至多 max_depth 个目录 descriptor 与 iterator、至多128排除路径，不保存全树清单。

## 真实消费者和接入

Web提供的[固定两caller](caller-inputs.json)已逐字校验；Quick b454 与当前 DPERF 67b4 都使用 exact exclusion。旧DPERF 498只有历史比较意义，不作为当前来源。后续由各原 owner 在新准备的 caller 版本替换 `sizes`，分别测 scratch 和排除 scratch 的 retained root；其它 evidence/reserve bytes 由 caller 相加。unknown 必须保留原资源停止/KEEP语义。历史/正在执行封套不回填；本片不写两caller。

## 验收 / 当前阶段

先纯目录及故障注入覆盖 regular/sparse、exact exclusion、root pin、消失、替换、symlink、跨设备、special/I/O、entry/depth/time bounds、descriptor关闭及两caller形状。仅本模块和直接 toy，不运行 PG/浏览器/provider/服务。累计≤60s工作、≤4MiB私有tmp、≤256KiBraw，fresh至少1GiB+声明新增。完整OPS-METER01还需后续两个真实caller接入与实际证据，当前未完成。
