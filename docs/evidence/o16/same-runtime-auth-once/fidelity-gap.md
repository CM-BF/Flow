# 认证状态记录封存缺口

本机文件系统路径大小写不敏感。运行器先 exclusive 创建 `result.json`；随后封存写入派生 `RESULT.json` 时，实际覆盖了同一文件。首次 Git 固定477e中的 `result.json` 已是事后摘要，当前原字节保留，不改成“原始运行报告”。这不是ignored文件丢失。

完整 native supervisor observations、secondary_failures 和原 result 字节未另存，不能恢复，也不从现摘要重建。`RESULT.md` 的“原始运行结构记录只保一份”及原manifest中描述的完整程度以本缺口为限定。准备进程 `preparation.json`、两份 reservation、`prepared.json`、`cleanup.json` 未被覆盖；当时工具完成回执 f83f90/outer0 保留了受控白名单/exit1/ownedState absent/KEEP/174ms。`disposition-summary.json` 区分这些来源。

现可核结论仅固定同runtime私有recipe公开状态未识别登录，未新增query。不能据摘要当作完整native组逐条观察审计，也不将其证明为账户退出或Keychain具体原因。279B原stdout/stderr按授权本就不持久、不hash、不输出；本次缺失与敏感原文不留盘是两件事。

不重跑认证，不补造原件。后继记录使用不同语义名字如 `disposition-summary.json`，不用仅大小写不同的名称。旧三次模型调用/费用UNKNOWN/全部KEEP不变。
