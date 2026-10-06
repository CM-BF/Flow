# CTX02 固定Pi宿主hook兼容探针

2026-10-06 05:05:27 UTC。0模型/0云；未调用prompt/provider，没有安装或修改上游包。**默认SDK加载路径在隔离下失败；另获批准的显式factory入口完成真实hook/store观察。未知sidecar版本被接受，不能直接视为生产安全兼容。**

## 固定输入与真实seam

FLOW002的实际执行宿主`@earendil-works/pi-coding-agent@0.85.1`，复用其`/tmp/flow-harness-eval.iq7BzZ/node_modules`，没有使用顶层1.0.4。官方npm tarball integrity逐字核对；15个关键运行文件与现成依赖字节一致，详见[provenance](provenance.json)、[Pi metadata](pi-npm-metadata.json)。候选`billion-context-pi@0.1.83`，npm gitHead `1cb6340df262933c8e640a7f45e19a7b34fe1ed8`；tarball SHA256 `2b8185233a5c882fdf07e3c3068a499371c7ac79bd630dec42b4a796f8ec30d2`，integrity见[npm metadata](npm-metadata.json)。只下载/解包到专用tmp，无生命周期执行。插件实际导入的index/chunk及package/license均已hash。

插件声明构建依赖为Pi0.83.0、acp-kernel0.0.98；bundle未换为CTX01独立core0.0.101，不混结果。MIT许可：[Pi v0.85.1官方原文](https://raw.githubusercontent.com/earendil-works/pi/v0.85.1/LICENSE)、[固定插件原文](https://raw.githubusercontent.com/ranxianglei/billion-context-pi/1cb6340df262933c8e640a7f45e19a7b34fe1ed8/LICENSE)，本目录pi-LICENSE/plugin-LICENSE保留。Pi npm包本身无LICENSE文件，不能伪称从tar提取该许可。

原计划入口是stock DefaultResourceLoader.extensionFactories→createAgentSession→真实extensionRunner，而不是自制ExtensionAPI。默认路径04在DefaultResourceLoader.reload失败，未创建SessionManager。Root随后明确批准第二入口：stock loadExtensionFromFactory生成真实extension/runtime，经SDK支持的ResourceLoader数据接口提供显式空资源，再由stock createAgentSession创建真实ExtensionRunner/ExtensionAPI/context。没有伪造ExtensionAPI，也没有替换处理逻辑；唯一不同是略过默认资源自动发现。第二入口结果独立记录，不倒写默认入口成功。

## 已保存的实际运行

| 原始JSON | 观察 |
| --- | --- |
| [01](01-isolation-import.json) | OS全file-read allowlist在JS前SIGABRT；无插件加载 |
| [02](02-isolation-import.json) | 补充otool核出的17个固定Node dylib literal路径仍在JS前SIGABRT；无插件加载。动态库来源/hash保留node-dylibs.json，未将其当失败根因已经证实 |
| [03](03-runtime-isolation-import.json) | 改为OS network/fork/write + Node内建Permission Model读取规则，合成隔离断言通过，固定SDK/plugin import成功；child 734.108ms |
| [04](04-real-hooks.json) | 相同隔离/import通过；真实默认加载器 ERR_ACCESS_DENIED，child 397.919ms。2个检查通过，1个真实加载检查失败，不是3/3通过 |

最终[07](07-stock-factory-lifecycle.json)完成7个组（6组断言+1组stock存储行为观察），684.671ms；每次两份A/B合成材料48,168 bytes。05–07为三次必要开发诊断，累计材料144,504 bytes，6个初始会话ID；07另做5次同ID重开（全部运行共11次SessionManager创建/打开），不是只创建过2次会话，也不是性能循环。全部有JS记录child累计2697.117ms，加01/02的JS前失败总墙时约3秒，未接近2min上限；最慢不足1秒。每个child超时20秒，stdout上限1MiB，输出wx防覆写，finally仅删除随机本实验目录/合成外部sentinel。运行原始hash见[manifest](raw-manifest.json)。07中sourceHashes对应最终脚本；04固定源码可在9733f4b69379ff1b7f9101089bf7c36e34c99090读取。01–03/05–06是开发诊断的历史源码hash，不能称它们对最终脚本的重跑。

**失败位置**：stock `package-manager.js:277 findGitRepoRoot → collectAncestorAgentsSkillDirs → addAutoDiscoveredResources → resolve → DefaultResourceLoader.reload`。即使noExtensions/noSkills/noPromptTemplates/noThemes/noContextFiles全为true，默认发现流程仍先向祖先目录existsSync。Node拒绝读取。只读源码还显示后续会发现用户`~/.agents/skills`；该分支未执行到，不把静态观察当已发生读取。没有扩大白名单、重设HOME、篡改默认loader或读取真实凭据。

## 隔离、设置与限制

OS `sandbox-exec`实际deny全部network/process-fork/tmp外写；Node24内建Permission Model只允许固定node_modules、固定plugin包、随机实验目录读，只有实验目录可写，不给addons/WASI/child/worker权限。合成越界sentinel read/child API均ERR_ACCESS_DENIED；loopback socket为EPERM。JS注册hooks只绑定插件bare SDK import到固定0.85.1，未改任何上游实现或模拟宿主API。二者分别是运行时和OS阻断；没有拿monkeypatch当沙箱，也不把本片当恶意包安全认证。初始过严OS文件读取规则失败被保留。

child环境仅PATH/LANG/TZ与本实验ACP/PI开关，没有继承真实token或设置HOME。明确ACP_AUTO_UPDATE=0、autoUpdate:false、delegate:false、throttleRetry:false、专属ACP_LOG_FILE/PI_CODING_AGENT_DIR；空内存credentials、modelsPath:null、allowModelNetwork:false、refreshOnCreate:false。插件默认autoUpdate=true且可访问homedir配置/日志，这些默认风险仍是采用前必须解决的输入。

raw的promptCalls/providerCalls=0是探针源码未调用这些API的声明，**不是provider调用拦截计数**；实际网络不可送达由独立OS负例证明。默认加载失败发生在真实hook之前，其结论不变。第二入口实际结果见下节。没有调用native模型摘要、验证摘要语义/真实provider请求兼容；0.0.98 bundled token估算不是模型账单证据。最终07使用显式probeInvokedPrompt/probeInvokedProvider=false，并注明providerAttemptCount未instrument，避免把常数当测量。

## 重跑与质量

在来源路径仍存在并核对provenance后，用Node24运行`experiments/context-pi-hook/run.mjs /tmp/ctx02-new-output.json default`或末尾`factory`。预期默认路径可产生blocked结果；launcher进程成功保存JSON不表示stock行为通过，须读child.outcome/cases。重跑不是交付要求，不对固定raw覆写。

已读用本地find-skills/codebase-design/clean-code/tdd/brainstorming；Root批准的有界spike，不重复设计审批，无新skill安装。真实公开SDK seam先验证资源隔离，负结果保留；未把模块加载失败当压缩行为的TDD红例。2026-10-06 05:01:04 UTC clean-code检查：launcher仅进程/隔离/原始输出，worker仅断言/真实SDK调用；错误结构化、超时与清理有界。未执行到的后续断言明确标未测，没有产品改动。

## 已批准factory对照：实际结果与采用缺口

[05](05-stock-factory.json)首先通过真实factory、两真实日志及context标签/会话材料隔离；compress拒绝小材料，因为默认preserveRecentTokens=5000。保留此配置负例。随后使用候选公开AdapterConfig.coreOverrides将preserveRecentTokens明确设0（preserveRecentMessages也为0），这是固定合成小输入的实验配置，不是stock默认或源码patch。

[06](06-stock-factory-lifecycle.json)压缩与decompress已执行成功，但探针错误地断言summary必须出现在plain text。源码coreOutToAgentMessages明确跳过synthetic summary；真实消息将摘要保存在原compress toolCall.arguments。此失败是探针消息类型假设错误，不能判插件丢失摘要。最终07保留严格要求：完整摘要仍在传出的真实toolCall.arguments；8条压缩原文离开可见text；decompress b1/full/inline各会话4条逐字出现且无另会话标识。没有删掉摘要保留或原文一致断言。

07最终结果：

| 实际行为 | 观察 |
| --- | --- |
| 两会话真实context | 两不同session ID，同m00002..m00005/b1在各自上下文指向各自材料；无相互文本污染 |
| 注册compress/decompress | 2块/8原文逐字回取；摘要保存在transmitted compress调用参数中，非独立text消息 |
| 原生日志/sidecar重开 | 新factory/runtime + SessionManager.open，session ID和decompress结果hash相同；仅同OS进程关闭重开，非独立进程/native模型resume |
| 唯一压缩owner | stock prepareCompaction + before_compact真实dispatch返回cancel:true；disabled新factory无context handler/无compress tool/无cancel结果；没有启动模型compaction |
| sidecar缺失 | 从本合成真实Pi journal中compress调用重建；8条中的A会话4条仍可回取；新schemaVersion1 |
| sidecar未来版本999999 | **仅schema-newer警告，接受并merge，再写回1**；原文仍可回取。不是未知版本拒绝测试通过，生产采用需独立host fence/迁移策略 |

A回取SHA256 `73ccdbddae45ef30d0c3fc6da36c6f0552472c239b438d206a467d68699a4195`；B `17b5872b1156c3f6c23b3b9f0da92032e3ec9ec16d055cd636bfa497e5b8b06d`。07原始SHA256 `6c8eaa506aa462b1bdc695bc394a4ef206b90fef1676c9c701f0309fefdba02e`。固定source与07 raw hash已离线核对，无重跑。

未测试：未知字段/任意损坏或恶意store、跨进程/跨机恢复、多compaction插件竞争、实际provider签名/缓存、模型是否会自行正确写summary或调用工具、Pi其他版本、原文被外部改写后的生命周期。未来schema未拒绝和默认资源发现是采用缺口；本实验不修stock，不新装proxy，不推断费用/容量。

2026-10-06 05:05:27 UTC clean-code交付复核：实际运行/声明/未测分开，loader对照显式mode，所有raw保留；probe计数字段歧义已在最终输出改为声明并保留历史解释。两脚本职责清晰、只有真实SDK seam，不另建mock协议。
