# TUI01F-03 focused 类型检查

固定增量 `40508f18432ffc20eadd638b208841a364c72bea`。首次2.18s退出2，唯一TS2339为fixture把TaskSubmission当作带id的权威任务；改为`context.executionIdentity?.taskId`并在缺失时明确拒绝。复查2.16s退出0。两轮只选fixture/journey两个root，编译器递归读取205个本树类型源与505个外部声明；不是两项测试通过，也不是root noEmit。真实旅程仍NOT_RUN。

[固定绑定](journey-static-manifest.json)保存2增量源、3旅程源、原9保护源、23原输入和5份原始记录。原da673源审/manifest、旧36检查均不改。固定后相对da673只有fixture身份读取修改，控制器/Ink/runner/server均未改。该增量尚待独立只读复审。

`journey-focused-tsconfig.json` extends原编译选项、`include: []`、仅2个files，`noEmit: true`、`incremental: false`。现有I02公开第三方类型入口版本与hash见preflight；@flow/plugin-runtime按真实package exports指向本树package-store.ts。无安装/新依赖链接/修改donor，不把类型可读说成运行依赖齐备。

资源：初始空间1,060,343,808B低于1GiB+8MiB时未启动。两次执行前分别1,225,121,792B和1,222,946,816B；每次30s上限，原始输出分别99,289B/98,867B，临时采样0B且自有目录已删除。未输出构建产物，未运行PG/HTTP/PTY/browser/provider。preflight曾在任何配置写入前断言不存在的惯例index.ts，实际固定export核对后使用package-store.ts；该准备错误未启动编译器。

2026-10-06 16:45 UTC clean-code复核：职责仍是有界测试资源生命周期；实际task身份来自宿主Interface，缺失是错误，未用类型断言掩盖。没有改公共协议/任务取消语义/旧FSM，新增fallback为零。后续需要真实运行依赖视图与串行资源窗口，03/04保持开放。
