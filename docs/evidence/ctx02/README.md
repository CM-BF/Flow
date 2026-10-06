# CTX02 固定Pi宿主隔离与加载负结果

2026-10-06 05:01:04 UTC。0模型/0云；未调用prompt/provider，没有安装或修改上游包。**默认SDK加载路径在隔离下失败；hook/store/压缩兼容仍未测。** 这份小交付不声称通过。

## 固定输入与真实seam

FLOW002的实际执行宿主`@earendil-works/pi-coding-agent@0.85.1`，复用其`/tmp/flow-harness-eval.iq7BzZ/node_modules`，没有使用顶层1.0.4。官方npm tarball integrity逐字核对；7个关键运行文件与现成依赖字节一致，详见[provenance](provenance.json)、[Pi metadata](pi-npm-metadata.json)。候选`billion-context-pi@0.1.83`，npm gitHead `1cb6340df262933c8e640a7f45e19a7b34fe1ed8`；tarball SHA256 `2b8185233a5c882fdf07e3c3068a499371c7ac79bd630dec42b4a796f8ec30d2`，integrity见[npm metadata](npm-metadata.json)。只下载/解包到专用tmp，无生命周期执行。插件实际导入的index/chunk及package/license均已hash。

插件声明构建依赖为Pi0.83.0、acp-kernel0.0.98；bundle未换为CTX01独立core0.0.101，不混结果。MIT许可：[Pi v0.85.1官方原文](https://raw.githubusercontent.com/earendil-works/pi/v0.85.1/LICENSE)、[固定插件原文](https://raw.githubusercontent.com/ranxianglei/billion-context-pi/1cb6340df262933c8e640a7f45e19a7b34fe1ed8/LICENSE)，本目录pi-LICENSE/plugin-LICENSE保留。Pi npm包本身无LICENSE文件，不能伪称从tar提取该许可。

原计划入口是stock DefaultResourceLoader.extensionFactories→createAgentSession→真实extensionRunner，而不是自制ExtensionAPI。首次DefaultResourceLoader.reload就失败，未创建任何真实SessionManager实例，当前合成原文输入0 bytes（脚本计划上限1MiB），两个session测试尚未执行。后续需明确批准另一个stock factory入口后单独对照，不能把它倒写成本入口成功。

## 已保存的实际运行

| 原始JSON | 观察 |
| --- | --- |
| [01](01-isolation-import.json) | OS全file-read allowlist在JS前SIGABRT；无插件加载 |
| [02](02-isolation-import.json) | 补充otool核出的17个固定Node dylib literal路径仍在JS前SIGABRT；无插件加载。动态库来源/hash保留node-dylibs.json，未将其当失败根因已经证实 |
| [03](03-runtime-isolation-import.json) | 改为OS network/fork/write + Node内建Permission Model读取规则，合成隔离断言通过，固定SDK/plugin import成功；child 734.108ms |
| [04](04-real-hooks.json) | 相同隔离/import通过；真实默认加载器 ERR_ACCESS_DENIED，child 397.919ms。2个检查通过，1个真实加载检查失败，不是3/3通过 |

全部child小于2分钟，最慢不足1秒；无性能重复或provider重试。每个child超时20秒，stdout上限1MiB，输出wx防覆写，finally仅删除随机本实验目录/合成外部sentinel。运行原始hash见[manifest](raw-manifest.json)。04中sourceHashes对应本次固定脚本；01–03是逐步launcher前置诊断的历史源码hash，不能称它们对最终脚本的重跑。

**失败位置**：stock `package-manager.js:277 findGitRepoRoot → collectAncestorAgentsSkillDirs → addAutoDiscoveredResources → resolve → DefaultResourceLoader.reload`。即使noExtensions/noSkills/noPromptTemplates/noThemes/noContextFiles全为true，默认发现流程仍先向祖先目录existsSync。Node拒绝读取。只读源码还显示后续会发现用户`~/.agents/skills`；该分支未执行到，不把静态观察当已发生读取。没有扩大白名单、重设HOME、篡改默认loader或读取真实凭据。

## 隔离、设置与限制

OS `sandbox-exec`实际deny全部network/process-fork/tmp外写；Node24内建Permission Model只允许固定node_modules、固定plugin包、随机实验目录读，只有实验目录可写，不给addons/WASI/child/worker权限。合成越界sentinel read/child API均ERR_ACCESS_DENIED；loopback socket为EPERM。JS注册hooks只绑定插件bare SDK import到固定0.85.1，未改任何上游实现或模拟宿主API。二者分别是运行时和OS阻断；没有拿monkeypatch当沙箱，也不把本片当恶意包安全认证。初始过严OS文件读取规则失败被保留。

child环境仅PATH/LANG/TZ与本实验ACP/PI开关，没有继承真实token或设置HOME。明确ACP_AUTO_UPDATE=0、autoUpdate:false、delegate:false、throttleRetry:false、专属ACP_LOG_FILE/PI_CODING_AGENT_DIR；空内存credentials、modelsPath:null、allowModelNetwork:false、refreshOnCreate:false。插件默认autoUpdate=true且可访问homedir配置/日志，这些默认风险仍是采用前必须解决的输入。

raw的promptCalls/providerCalls=0是探针源码未调用这些API的声明，**不是provider调用拦截计数**；实际网络不可送达由独立OS负例证明。默认加载失败发生在真实hook之前，不宣称已覆盖压缩工具、两会话隔离、store重开/缺失/未知、native compaction owner、disable或摘要语义。源码显示更高sidecar schema仅warn再merge，但尚未实测，不预判验收通过/拒绝。

## 重跑与质量

在来源路径仍存在并核对provenance后，用Node24运行`experiments/context-pi-hook/run.mjs /tmp/ctx02-new-output.json`。预期默认路径可产生blocked结果；launcher进程成功保存JSON不表示stock行为通过，须读child.outcome/cases。重跑不是交付要求，不对固定raw覆写。

已读用本地find-skills/codebase-design/clean-code/tdd/brainstorming；Root批准的有界spike，不重复设计审批，无新skill安装。真实公开SDK seam先验证资源隔离，负结果保留；未把模块加载失败当压缩行为的TDD红例。2026-10-06 05:01:04 UTC clean-code检查：launcher仅进程/隔离/原始输出，worker仅断言/真实SDK调用；错误结构化、超时与清理有界。未执行到的后续断言明确标未测，没有产品改动。
