# CTX02 固定Pi宿主上下文hook探针

编号CTX02；状态in-progress；创建2026-10-06 04:55:34 UTC。唯一owner runner_owner / gpt-6-astra，base e802854f346a81749efdef3f36737b16141b98ef。

## 已批准问题与边界

有界可丢弃兼容spike：官方Pi SDK 0.85.1真实加载billion-context-pi 0.1.83，驱动公开扩展hook和已注册compress/decompress工具；两合成会话验证引用原文、隔离、真实SessionManager存储关闭重开及缺失/未知store、原生compaction owner与disabled。固定手写summary；0prompt/provider、0模型/云、两session累计原文<=1MiB、全部child执行<=2min，每child<=20s，不做性能重复。

依赖复用FLOW002临时独立node_modules；候选npm tarball先核完整性，不全局安装、不执行生命周期、不改根deps。插件声明build kernel0.0.98与CTX01 core0.0.101不同，不混结果。fixed npm gitHead1cb6340df262933c8e640a7f45e19a7b34fe1ed8，不取GitHub移动master。两包MIT许可分别保留/引用，实际bundle来源另记。

关闭ACP自动更新、委派、throttle retry；内存空credentials、禁catalog refresh，绝不读真实凭据或改HOME。先建立并验证OS/runtime阻断，JS观测不能称安全沙箱；共享用户目录读取或外部副作用被拒时保留stock错误，不静默patch/扩大路径白名单。候选补丁须另审。不会使用自写ExtensionAPI mock替代真实宿主兼容。

## TODO

- [x] CTX02-01：独立worktree/原子claim、固定来源/API及隔离方法。
- [x] CTX02-02：真实固定宿主加载/公开hook、合成两会话压缩与精确原文回取。
- [x] CTX02-03：真实store生命周期与缺失/未知行为、压缩owner/disabled；保留拒绝与限制。
- [ ] CTX02-04：固定原始JSON/source/hash/许可、clean-code和独立review（NOT_STARTED）。

实现seam为真实DefaultResourceLoader.extensionFactories→createAgentSession→session.extensionRunner.emitContext与注册tool.execute；无需调用prompt。若stock在隔离下不能驱动，02/03写实际失败/未测，仍可交有边界负结论，不以mock冒通过。技能本地find-skills/codebase-design/clean-code/tdd/brainstorming实际读用；probe方案已由Root/Lead批准，不重复审批。

2026-10-06 05:05:27 UTC 默认loader被白名单拒绝后，Root另批准stock factory+真实SDK上下文对照；07完成7组观察。未来sidecar版本仅warn并写回当前版是已验证采用缺口，不修改stock。所有初始失败保留，不重跑负载。
