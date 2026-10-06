# CTX01：原生宿主与缓存限制

观察日期2026-10-06；本owner于2026-10-06 04:46:54 UTC实际读取下面官方页面，收录Root研究输入。仅说明后继边界，不扩大fixed f58fdf36实验或重跑负载。

Claude缓存按tools→system→messages前缀组织；改工具name/description/参数schema会破坏相应缓存前缀。故压缩可见bytes或更新工具声明，不能默认仍享原缓存命中。[官方prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

官方context editing区分服务端编辑与客户端历史；其服务端策略允许客户端继续保存完整原历史，而客户端改早先turn可能影响后续thinking block有效性。清理工具结果或thinking还可能引起缓存失效和重新写入成本。这些API文档不自动证明固定Agent SDK/native CLI暴露同一个编辑入口。[官方context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing)

## 后继harness必须明确的Interface

- 展示用正文/thinking、模型输入可编辑内容、native opaque resume记录/签名必须分型。可显示或可JSON序列化，不表示可改签名/重写恢复历史。
- 每个harness声明具体context编辑seam、哪些message类型可改、原文/签名由谁保存、resume/fork支持边界、唯一compression owner及冲突处理。CTX01的宿主JSON/revision fence不能替代这些事实。
- Root研究输入的后继优先级是核Pi官方context hook候选；具体固定宿主版本和hook行为尚未在CTX01核验。Claude/Codex仅先作能力探针，不静默引入proxy或透明历史改写，不安装Pi/proxy。
- 后续成本比较须包含cache读写、摘要生成、检索、重试、质量/遗漏与失败恢复。CTX01只给bytes/CPU/RSS/hash和合成宿主行为，没有provider token/账单/语义质量证据。

通用kernel压缩成功不证明Claude或Codex可以透明修改带签名内容、原生resume历史或提供相同缓存行为。所有新模型/认证/安装实验须另行明确范围，本补充未执行这些动作。
