# TUI01G 固定源码（验证待运行）

source `215063fb4667fc394a07417d608b075fa1188d92`；base `93a92c918b29126b6761b02258cef523906eca94`。12 个 source 文件：有限选择/显示 Module 与 controller 命令、主入口/Ink/README 及直接用例。Interface见[interface.md](interface.md)。

claim v1 与 F v5 handback 已固定；仅13个 absent 依赖链接，0安装/复制。首 fresh gate 可用1,065,254,912B < 1,107,296,256B，局部检查 NOT_RUN。12 个新 case 只写未运行（3 pure/8 controller/1 Ink）；HTTP/PTY/PG/provider 同为 NOT_RUN。原 controller/queue/task/terminal tests 保持只读，未来只作为直接消费者。

[manifest](manifest.json) 固定源码/原输入/证据。源码自查不是独立 approval；source-only 提交可供 reviewer 提前读，运行事实待有足够余量。access 来自不可变 profile，requested 仅完整 model/thinking/effort/speed；Codex 普通会话仍 unsupported。
