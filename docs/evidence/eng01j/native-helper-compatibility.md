# 已冻结 J 之外的只读兼容输入

本次仅源码/既有Mika证据读取及精确本机binary hash，没有运行binary/help/SDK/provider或新增进程实验。Mika树观察HEAD6dfbb213405013dea8b039670e93c6a4d8d283a3。

本机固定 `/opt/homebrew/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex` 222655232B/SHA256 `4f85982624b3898c8991cb80c0981b2aa71070e3537046c9a95950318a95afcc`，package版本0.154.0-darwin-arm64，与Mika旧schema/probe输入一致。版本/字节不是可复现binary→源码证明。Mika native-catalog-probe原实跑ready前SIGABRT、model/list0；未有本机selected apply_patch/file-write route。没有重复读取私有stderr正文。

固定 rust-v0.154.0 的条件源码链重算与Root一致：

| 源码 | SHA256 | 相关条件 |
| --- | --- | --- |
| [tools/runtimes/apply_patch.rs](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/core/src/tools/runtimes/apply_patch.rs#L175) | 7087505ab6fb827c252365a92e5ef675ed36dcdeee18ce32637edcd736e7b4f1 | 读取turn environment的filesystem与sandbox context；不是handlers同名文件 |
| [sandboxed_file_system.rs](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/exec-server/src/sandboxed_file_system.rs#L146) | aa4b733f6f1495b62ff8da1c046a0563deb2a7a75f0b72c20377f10fd2e1eead | write→run_sandboxed |
| [fs_sandbox.rs](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/exec-server/src/fs_sandbox.rs#L151) | 4d40540563677fecb30ee47f6471e6c15548d4a3fd0d3caf06ce2a3074815f24 | helper使用同codex binary，SandboxManager Require，spawn+Darwin pre_exec关闭额外FD |

local_file_system.rs选择sandboxed分支的前提是should_run_in_sandbox；file-system/lib.rs395–402为restricted且非full-disk-write。helper参数为 --codex-run-as-fs-helper。由此推断J全禁fork/其它exec与该受限本地路径冲突，不声称本机已失败，也不通过切unsandboxed来解决。

后继最短实验先固定实际stock binary/helper入口、有限私有文件和准确sandbox请求，0query核真实启动/目标写/越界拒绝/FD/停止。保原上游sandbox，只在具体有据后允许必需helper执行；不能把allow fork后的group absent说成全writer停止。R06当前仅持直属child，应先评估现成可信终止域或所有helper的准确admission/drain事实，缺失保持unknown；本片不建新exec-server分叉或第二executor。实际模型/no-fallback和provider网络独立开放。全部后继运行需新的明确有界安排，本文不是运行许可。

Mika输入：claude-codex-capabilities/docs/evidence/wpf-mature-02/{bootstrap-policy-readonly.md,native-engineering-authority-inputs.md,native-catalog-probe/run-report.md,schema-source.json}。旧报告中的file-only禁exec是当时受限recipe边界，不能成为用户全部工程任务永久禁止有界合法shell的要求。
