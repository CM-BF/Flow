# WPF-PERF01 审查

**NOT_STARTED**。Target：UNKNOWN；Base：`c526c1c889437ee39155d669921577995195c74e`。

范围：两个 performance 测试脚本与本任务计划/证据。生产 App、公共契约、I01 接入及未来优化不在范围。

审查标准：fixture 与真实 App/隔离 probe 指标不混淆；固定生产 build、原始样本与版本；真实输入/滚动而非仅函数计时；数量、缓存、观察预算有效性断言；失败/unknown 保留；服务有界清理；没有 scope 外修改。

已执行：初始 tree/branch/HEAD/dirty 与 D04 当前 receipt 核验。未执行：测量脚本/生产规模结果与独立 review。Findings 尚未评估；不等于无问题。

```text
只读审查 WPF-PERF01 固定候选。先核验实际 branch/HEAD/base/dirty、D04 scope；读 plan/status/evidence 和两个脚本。检查可复现性、采样有效性、失败边界、真实 App 与隔离 projection 区别、是否保留未知，必要时独立跑小样本。结论绑定完整 SHA；修改交唯一 owner，不能把基线当优化完成或 I01 性能。
```
