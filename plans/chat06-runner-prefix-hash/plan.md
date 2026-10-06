# CHAT06P03 runner 正文前缀增量哈希

状态：in-progress。2026-10-06。Owner architecture_read / gpt-6-astra；co-lead mika。所属大task FLOW-001；前序追溯 CHAT06-07、REQ15/17。本片不改变已交付DB侧CHAT06P02，不把原CHAT06计划建立成第三层父任务。

已获GO/Mika明确授权的bounded设计：每个block保存sentBytes与独立SHA256状态；seal仅输入本次patch text，copy().digest生成完整prefix摘要，原Hash继续使用。sent仍为UTF16位置，content完整保留供原assistant-final核对；输出字段、revision/phase/reason、空patch、取消/关闭、markers/frame去重均保持。状态归属只在AssistantTextAccumulator.Block，不新增公共Interface、缓存模块或第二状态机。根[modular-design](../../AGENTS.md#modular-design)适用。

原始index/accumulator按base bd14f984e3927df139815597c4c3171af84ec4b7逐字复制到docs/evidence/chat06p03/baseline，保持相对import深度。只测试公开coalescer，不调用SDK/provider。对照所有frame/patch/marker完整对象；测量原Hash.update与Buffer.byteLength实际输入总字节，包含双方相同的frame fingerprint/id开销，非prefix-only测量，不推断CPU收益或修复append/utf8Prefix的全部重复扫描。

| TODO ID | 验收 | 状态 |
| --- | --- | --- |
| CHAT06P03-01 | 合法scope、固定baseline/闭包、状态与预算 | completed |
| CHAT06P03-02 | 有意义性能字节反例red→局部最小实现 | in-progress |
| CHAT06P03-03 | 公开输出等价：Unicode/切片/多块/重复/空phase/tool/result前flush/aborted/superseded/abort/错误 | pending |
| CHAT06P03-04 | 双实现受控降低limit的truncated对照，明确非生产1MiB上限实测 | pending |
| CHAT06P03-05 | 固定source/raw/局部strict、独立review、main接收及交回 | pending |

一次检查段合计≤30秒、raw≤2MiB；baseline+candidate两实现、red+green所有实际注入帧含full assistant的JSON UTF8累计≤1MiB/256帧。主样本64KiB正文、16×4096 delta、等长full；专测跨轮累计前轮计数，超限失败。原stream.test超窗case不删、不选择、不称通过。低limit只在独立专测对同一公共contract module双实现替换常量，不改生产合同。0PG/原生SDK/provider/install；依赖来自既有main public安装，仅类型/测试包，产品source全部本树。实际检查先fresh资源≥1,107,296,256B并获Mika小窗口。

本树由Lead唯一provision，不改sparse/config/symlink；scope之外任何缺失import精确请求Lead。plan索引及dashboard registry由Lead登记，worker不改共享源。
