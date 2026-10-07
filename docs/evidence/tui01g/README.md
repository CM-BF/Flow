# TUI01G 固定源码与局部验证

source `215063fb4667fc394a07417d608b075fa1188d92`；base `93a92c918b29126b6761b02258cef523906eca94`。产品 12 文件保持已独审的原样字节，本轮只新增验证/依赖身份修正/metadata。Interface 见 [interface.md](interface.md)。

原 NOT_RUN 与 SOURCE_APPROVED_PENDING_VALIDATION 保留。新资源授权后，fresh claim v1、clean HEAD、212 source/protected bindings 与 13 依赖链接均核对；free 26,753,818,624B 高于原 1,107,296,256B 准入线。没有安装或复制 payload。

| 轮次 | 实际范围 | 结果 |
| --- | --- | --- |
| new-01 | 12 新用例 | 11 pass / 1 Ink fail，exit 1 |
| types-01 | focused TypeScript | exit 0，不是 root 全库 |
| direct-01 | 39 既有直接消费者 | 37 pass / 2 Ink fail，exit 1 |
| ink-02 | 仅三个失败用例 | 3 pass / 2 未选，exit 0 |

共 51 个不同用例最终分轮通过（12 新 + 39 旧）；没有重跑已绿的无关用例。三个首次 Ink 失败是 `ink-testing-library` 跨 donor 引入第二份同版本 React/Ink。经 Lead 精确授权，仅重建本树自建 ignored 链接到 I02 已存在 4.0.0 包；六 payload 文件共 10,991B 与原包逐字一致，解析后的 React/Ink 单一身份已核。原红 stdout/stderr 未改，见 [dependency-ink-repair.json](dependency-ink-repair.json) 与 [validation-summary.json](validation-summary.json)。

每命令复用已审 OPS14 监督，27s work + 0.5s TERM + 2s reap，总输出 cap 256KiB。实际最长 3,356ms，四 owned group 均 absent/管道 EOF，raw + cache 峰值 10,380B；738B 自有 cache 在持久 checkpoint 后正常清除。每命令 reservation、原始 stdout/stderr、exit/资源事实均在本目录；run-local-validation.py 为薄调用记录，不复制监督循环。

本片只证明纯合同/controller、controlled ports 下真实 Ink 与 focused types。HTTP socket/PG/Chrome/真实 PTY/provider/F04 未运行；不证明完整 TUI→Web 旅程。新行为证据等待独立审查，不能把作者验证当产品 approval/main 接收。access 来自不可变 profile，requested 仅 model/thinking/effort/speed，Codex 普通会话仍 unsupported。
