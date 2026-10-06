# 单 Web 正式 prepare：只读 preflight 与待裁决守卫方案

未执行 build/install/写权限试验/目录清理/进程停止；未写项目或读个人配置、环境、command arguments/凭据。只有 `/tmp/release03-prepare-readonly-preflight` 报告。源/工具沿既有只读研究，不重复依赖扫描。

## 本人 fresh 观察

- `2026-10-06T13:56:38.401887Z`：WT `/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-attachment-production`，branch `codex/web-attachment-production`，HEAD `5069586a9f17332de526e101eca3a4250cbc8d91`，`status --porcelain` 空。获审实现仍9eec provenance，不假写 sourceHead=9eec。
- 同时 df：WT 与 `/tmp` 同 `/dev/disk3s5`，Available **1,366,220 KiB = 1,399,009,280 bytes ≈1.303 GiB**。随后 statvfs/disk_usage读数为1,399,001,088 bytes（差8192B说明采样本身不同步）；均为整个共享volume可用量，不是我专属预留。相比1GiB约余325.3MB，不代表可实际保证该余量。
- `13:56:49.555821Z`：一次非提权 `lsof -nP -Fpcfn`，exit0，stderr空，0.563秒。仅保存匹配该WT的路径、FD与短 executable 名；未读环境/命令参数。结果**没有该WT cwd或打开文件的匹配进程**，包含配置/cache/node_modules路径。不是进程未来不会使用它的证明，也不消除不可见/racing进程；执行前须再核并协调本WT不并行运行Vite。
- exact cache dirs 与父 `apps/web/node_modules` 都是真实目录、非symlink、UID501/GID20、0755；`os.access(W_OK/X_OK)=true`。本人UID501。两精确目录：`apps/web/node_modules/.vite-temp`、`apps/web/node_modules/.vite`。仅stat/access，**没有创建写测试文件**。完整路径、时间和读数见filesystem.json；进程观察见consumers.json。

## 原 owner 对潜在写范围的说明

ATTACHI旧所有 source/生产写保持停止；旧26scope已经释放，本确认不恢复旧写权。如果 root 明确批准一次prepare且manager取得 fresh独立运行claim，我同意本人仅使用旧WT下上述两个精确cache目录，以及新的**自有私有artifact输出**，source不改、旧raw/evidence/配置/依赖不删。建议输出与诊断都放未来明确许可的 `/tmp/flow-release03-prepare-5069586-<fixed-run-id>/`，0700真实目录；此路径目前只是候选，未创建。

固定工具 `84005a260dfcb668cd38b09c21564d0754a0f513:tools/personal-preview/web-artifact.mjs` 读取旧source506，使用固定32hex releaseId，产出正式format2。raw产物不能改名当正式manifest。旧树与获审生产相同的证据沿前报告。

### EACCES 配置临时文件的剩余权限边界

已安装Vite node.js:37901–37922：对最近 node_modules 的 `.vite-temp` 做recursive mkdir；**该 mkdir 返回EACCES时**转为 `apps/web/vite.config.ts.timestamp-<time>-<random>.mjs`。若mkdir成功而后续writeFile失败，则直接失败，**不会**再fallback。

因此现有真实、本人可写的目录是正常路径的有利前置条件，可执行前再stat/realpath/access，但不能消除权限/ACL/挂载/目录替换的TOCTOU变化，不能保证绝不写配置旁。潜在第三写位置明确如上，是动态文件名，不能用两cache claim谎称覆盖它。监控发现后中止也不是预防首次越界写。

固定SVC内部没有公开configLoader参数；使用显式`configLoader:'native'`可避开bundle temp分支，但那属于工具调用实现改变，且本轮无权改工具，未验证其兼容性。若只能允许两cache literal而要求**严格阻止**配置旁写，需由root/manager选择另行审定的文件系统写约束或显式工具接口；仅precheck不足以给“绝不”的保证。不要因此宽领整个apps/web或自行改权限/源码。这是仍需裁决的范围边界。

## 一次实验的拟议守卫（只是方案，不是许可/峰值证明）

- **所有权与进程组**：外层监督进程留在原组；仅新prepare child以独立process group/session启动。固定工具的internal-build默认非detached，继承同组。记录child/group ID及run marker，绝不根据名字pkill其它Node/Vite；不启动PG/Chrome/provider，不clone/install。完成正式descriptor或明确失败后才退出。
- **时间**：总壁钟候选120秒，工作≤100秒（内部工具既有build timeout90秒），至少20秒专留停止/清理。这些是拟定边界，不继承其它browser预算。超过工作截止即中止，不靠Promise.race遗失仍运行的启动/构建promise。
- **产物与日志**：提议原始dist累计逻辑字节16MiB、文件128个、单文件8MiB；cache新增量另设4MiB/config临时单文件1MiB，日志总≤1MiB。依据只是旧10files/1,588,017B终态的保守监测阈值，**不是已测峰值**；具体值须root裁决。固定工具64MiB为build后检查，不能替代运行中guard。
- **空间监控**：执行前再读整个volume的available与两cache基线；候选启动条件≥1GiB+128MiB；每500ms读取statvfs与自有stage/cache变化，若available≤1GiB+64MiB、产物超过上限、路径owner/realpath变化或监控失败，立即中止。开始条件和64MiB缓冲只是检测策略，不能保证突发写入或并发任务不会越过1GiB；不能把轮询冒硬磁盘quota。
- **中止与清理**：对自己进程组TERM，最多3秒后KILL，等待退出/关闭pipes；监督进程不被一起kill，负责最后清理。先确认已无该group/子进程继续写，才删除**这次run**的partial stage；完整正式artifact可保留以供verify。固定prepare自身finally并非SIGKILL后保证，因此不能仅依赖它。cache不整目录删除；只在能归因本build的新临时文件上清理，无法确认所有权则保留并报告unknown，不删已有cache/其它任务文件。20秒用尽仍不能确认退出/清理时报告失败/残留，不伪称clean。
- **事后证据**：以正式verify得sourceHead506/tree/lock/node/vite/releaseId/全files descriptor；保存开始/结束free、采样最小free、自有文件logical/allocated峰值和清理事实。全盘df变化不得归因本次；持续进程memory/swap、native scratch、APFS/COW、其它任务并发写入没有硬隔离，也未受stage阈值控制。

因此当前可提供“独立process group + 有限输出监测 + 磁盘余量预警 + own cleanup”的更小准备方案，但**仍未证明实际峰值或允许开跑**。若root需要硬限制，应使用真正quota/文件系统限制/资源隔离，现固定入口及轮询本身不提供。最新2.5GiB仅SVC06规则已理解，约1GiB收尾余量仍需在任何明确实验中保留。

本段0项目写入/服务操作；plain源码与旧产物保持。下一动作完全等待root资源裁决与manager fresh合法scope，不以本报告自动take或build。
