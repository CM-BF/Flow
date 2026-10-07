# MATURE02C01 固定交付证据

源码目标 `563b1ea151d8d26a2100238d8faf26b697f38d71`；受控基线 `8e9b35233e5b1e93df19e2ea802e0f2fbefc23f6`，其主线祖先 `74bc72f0d32daebc8f89a75528f3d72002b3a29e`。作者 native_center_owner / gpt-6-astra，2026-10-06 16:51:43 UTC。范围是共享客户端/CLI 的有限协议消费，独立 review 尚未完成，未集成 main。

## 行为与职责

唯一 FlowClient transport 增加明确协议目录读取；发送沿既有冻结 body 与 ACK Module，opt-in 入队增加严格不可变接受回执。CLI 三个 conversation 命令复用原 JSON 文件读取、错误和信号入口。请求 snapshot 与 observed 初始化分开，旧省略字段不补默认。无新状态机、自动重试、数据库连接或运行器。

公开合同仅增加 leaf export。CORE 六输入逐字保持；F01 的 O14 goalCommand、专测和 README 原前缀逐字保持，新命令只追加。两个 CLI 文件整体已因本片改变，不能称 whole blob 与 F01 相等。59 个非本片变动的物化规则/配置/源输入对受控基线相等，详见 [保护检查](protected-input-check.json)。O14 CLI 的历史测试只证明 transport/命令组合，不代表 O14 自动 scan/PG 验收。

## 实际检查

| 轮次 | 实际结果 | 原始输出与进程回执 |
| --- | --- | --- |
| 初始反例 | 2 失败、49 未选；缺新 reader 和 snapshot ACK 检查 | [stdout](initial-red.stdout.txt)、[exit](initial-red.exit.json) |
| 局部矩阵 | 82/82：目录 4、ACK 52、queue 5、CLI 18、既有 O14 CLI 1、JSON 输入 2 | [stdout](local-matrix.stdout.txt)、[exit](local-matrix.exit.json) |
| 两条新增直接用例 | 11/11：目录 5、queue 6；9 项与矩阵重叠、2 项首次 | [stdout](final-reader-queue.stdout.txt)、[exit](final-reader-queue.exit.json) |
| 预览边界修复前 | 2 失败、6 未选；过短合法前缀和截断 surrogate 均被旧 decoder 误接收 | [stdout](preview-boundary-red.stdout.txt)、[exit](preview-boundary-red.exit.json) |
| 预览边界修复后 | 2/2、6 未选；精确最长完整 code point 前缀 | [stdout](preview-boundary-green.stdout.txt)、[exit](preview-boundary-green.exit.json) |
| focused types | 三轮实际 exit 0，最后在预览修复后；均不是 root types | [初次](focused-types.exit.json)、[固定前](focused-types-final.exit.json)、[修复后](focused-types-preview-fix.exit.json) |

合计 **86 个不同用例**（19 新增、67 既有直接消费者），分轮通过；不是最后一次执行了 86 项。最初矩阵的测试文件 hash 记录在对应 exit JSON；最后两个回归及产品修改 hash 记录在修复后回执，等于最终 source target。保留全部红输出，未重跑全集。命令和 selected 数以原 stdout 为准；每个 exit JSON 是当次实际 subprocess 退出与 timeout 记录，不把 Python 包装器退出码当测试码。空 types stdout 与进程 exit 0 分开记录。

## 边界与资源

目录每页 ≤100、选择 ≤32、snapshot canonical ≤1024 字节、队列文本 ≤16000 UTF-8 字节、接受预览最长 ≤512 字节完整字符前缀，沿受控公有合同。新 preview 只扫描到第一个超界字符；不复制中心状态机，也不将 preview 当全文 receipt。CLI 文件入口沿现普通文件/UTF-8/131072 字节上限。

Node 24、Vitest 4.0.18、已装第三方只作链接复用，无安装/新依赖。[@flow 解析](dependency-resolution.json)均指本 WT；[依赖来源](dependency-reuse.json)可核。每个命令前实际 free ≥1 GiB+8 MiB、30 秒 deadline，实际无 timeout；raw 与证据测量见 [资源记录](resource-summary.json)。HTTP 使用 loopback 动态端口，finally 关闭连接与 server；文件用例清理自有临时目录。记录为有界局部检查，不推断整体吞吐或生产资格。

**NOT_RUN**：root 类型检查、真实中心 PG、provider/SDK、browser、Web/TUI UI、实际账号设置、生产挂载。CORE/F01 输入批准与实际能力边界独立；配置目录不证明资格，接受回执不证明执行成功。父任务的真实原生资格/全客户端验收仍开放。

[Interface](interface.md) · [质量记录](quality.md) · [唯一状态](../../../plans/mature02c01-claude-message-settings-client/status.md) · fixed-manifest.json 在证据提交后固定。
