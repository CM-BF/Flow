# TUI-001 研究与设计依据

2026-10-06，本轮0模型/0安装/0产品测试。已读取本地find-skills、codebase-design、clean-code、assistant-ui，并按find-skills找到/实际读取官方固定Ink skill及custom-backend/migration。全SHA/字节见research-provenance.json。外部skill是方法参考；默认ChatModelAdapter/LocalRuntime不符合本任务中心权威，不直接照搬其取消与本地存储示例。

- [固定Ink技能](https://github.com/assistant-ui/skills/blob/139674dc888ee076982b6726e8e6f5d0fe0b5f67/assistant-ui/skills/ink/SKILL.md)：终端有受控TextInput、字素编辑和显示列等能力，待固定包实际API验证；不自造UTF16编辑器。
- [assistant-ui Ink](https://www.assistant-ui.com/docs/ink) 与 [索引](https://www.assistant-ui.com/llms.txt)：框架可以提供终端呈现，但网络协议/历史归属需宿主确定。Flow不改为AI SDK聊天路由。
- [Hermes slash registry](https://hermes-agent.nousresearch.com/docs/reference/slash-commands/)：采用同一命令描述生成帮助/补全/入口的思路；Flow底层仍typed handler，不复刻Hermes的权限、压缩或重试语义。
- [Ink testing](https://github.com/vadimdemedes/ink#testing)：renderer测试与真实PTY旅程分层。只有纯输出快照不足以覆盖rawmode/resize/退出。
- 用户/GO已核的一手参考：[Codex slash](https://learn.chatgpt.com/docs/cli/slash-commands)、[Claude交互](https://code.claude.com/docs/en/interactive-mode)、[Hermes TUI](https://hermes-agent.nousresearch.com/docs/user-guide/tui)。本轮未重复抓取这三页，保留为交互借鉴入口，不声称读取闭源Claude内部源码。

本地base77c420c：apps/cli/src/index.ts 的runCli可注入IO/env/signal；watch.ts明确观察中断不cancel并用持久cursor重连；FlowClient已有conversations/profile/queue/steering/nativeActivities/assistantStream方法。Web使用React19.3.0、assistant-ui/react0.15.23；新terminal必须独立依赖锁定，不因最新docs升级Web。

本轮npm exact-version endpoint核Ink8.0.0（Node>=22/React>=19.3）、react-ink0.0.46和0.0.48（core下界不同）、ink-testing-library4.0.0均MIT；SRI/完整peer/deps候选另存package-candidates.json。未下载tarball/安装/执行脚本，兼容性仍待实现owner首个有界检查。依赖下载/构建与provider调用不同，不用模型验依赖。

设计应用：命令与观察复杂度藏在小Interface中；renderer不掌握授权/任务完成；只提取两个真实消费者共有概念，不将所有Web状态搬入新框架。每个片段保清楚输入输出、限额、生命周期、error/unknown，合并前独立检查与实际受影响证据。
