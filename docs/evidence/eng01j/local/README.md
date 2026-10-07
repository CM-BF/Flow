# ENG01J 本队有界局部记录

[run.json](run.json) 是本轮单份汇总；五个 round 目录保存原 reservation/result/stdout/stderr/cleanup，不覆盖失败。运行入口为本目录 probe.py，调用 run 01…05；round-03 仅 FLOW_ENG01J_DIRECT=1，round-04/05 仅 FLOW_ENG01J_DIRECT=types，其余为 tiny C 系统调用观察。未重新执行 H/G/F/I 全集。

| 轮次 | 实际结果 | 原因 / 范围 |
| --- | --- | --- |
| 01 | outer1 / child1，240ms | 首次 clang 未显式 SDK，errno.h 缺失；未运行 canary |
| 02 | outer0 / child0，876ms | 修正 SDK 后真实正常对照与受限 syscall；继承 FD 写仍成功是机制缺口，同编号关闭后 EBADF |
| 03 | outer0 / child0，950ms；4/4，0未选 | 真实 R06 factory 的 FD 关闭、同 handle close、身份变更/digest拒绝、未用关闭与纯路径边界；Node test内部累计294.599125ms |
| 04 | outer1 / tsc2，759ms | ReturnType<typeof lstatSync> 类型联合带 undefined/bigint 的原红 |
| 05 | outer0 / tsc0，744ms | 仅改为明确 numeric Stats；擦除后行为不变，因此未重跑原4例 |

累计监督 3569ms、原 stdout/stderr 5126B。五组均最终 absent、双 EOF、原 dev/ino 临时根正常删除；最大结束测量 139373B。没有持续磁盘峰值采样，不将 end checkpoint 当硬磁盘上限。监督历史 observation 的 EPERM 保留，没有将其直接改为 absent。

round-02 原始输出显示正常允许文件/越界文件/自有 Unix 委托均可工作；sandbox 后目标写成功，而越界、新建、link/symlink、rename/unlink、fork、Unix 委托和其它 exec 返回 EPERM。继承 FD 仍写成功，是真实安全边界而非测试失败被忽略；因此 round-03 改用真实 R06 验证固定 pipe-only launch。round-03 host 实际写 P，sandbox peer 同一 FD 得 EBADF，文件只保 P。

round-02/03 的 C peer 是受控小程序，无 SDK query。类型检查为本片四 TS 文件及直接 import 闭包的 focused noEmit；不是 root types。installed-entries 仅入口/包身份，未对整个已安装依赖树逐字扫描。

原 canary 编译失败和类型红保留；所有时间/字节分轮记录，不把四例与 syscall 测量凑成完整工程场景。尚无真实模型写改、provider 网络、全 IPC 或生产 grant/完整撤销结论。

## R1 测试入口修复

[revision-run.json](revision-run.json)保新增06–08的真实记录：正常Vitest入口1pass/3skip（不编译/启动canary）；显式Darwin canary入口4/4，host确实持有并写P、R06 child同FD EBADF；focused types0。新增2788ms/raw3195B；累计6357ms/raw8321B。两生产模块与C未改，不重复syscall。四行为例与旧轮重叠，仍4different。三个新组absent/双EOF/原scratch正常删除。

局部Vitest固定4.0.18，单thread池保持测试host的真实FD；产品测试仅标准import Vitest，普通根配置能发现/跳过依赖专用资源的组。证据配置只缩小选择并把cache放私有目录，无依赖安装。functions显示层只转发了执行output，新增三轮数字outer exit未另抄存；内部监督exit0/absence/EOF/cleanup均原始持久，不补造外层工具回执。
