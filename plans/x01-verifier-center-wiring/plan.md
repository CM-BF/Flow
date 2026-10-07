# X01-VERIFIER-CENTER-WIRING01 中心接线

所属大task：[X01](../../../plugin-enable-binding/plans/x01-plugin-management/plan.md)；co-lead mika；owner db_transaction_owner / gpt-6-astra。

目标：将已审 verifier 受理、授权和结果门禁通过现中心 factory 的唯一可信配置与认证入口一起装配。缺省不挂 verifier 入口，显式错误私有配置拒绝启动，不复制策略或算法。现插件迁移 observation phase 内依次执行034与036，保原生命周期和错误传播。

- [ ] X01WIRE-01 固定前像、领取与已审依赖组合。
- [ ] X01WIRE-02 main→factory→routes/events 同一 policy 完整接线。
- [ ] X01WIRE-03 真 factory/Fastify injection 局部行为及类型；真实PG另窗。
- [ ] X01WIRE-04 固定独审、登记与主线受控接收。

范围：main.ts、index.ts、plugin-runtime/routes.ts、新 plugin-verification-wiring.test.ts 与本计划/证据。VAR领域与AV迁移/codec仅自有evidence固定只读输入，不冒本分支或main已包含。禁止用旧ea3 index覆盖当前startup observer。

验收：默认关闭；显式策略被main载入且坏配置不启动；owner/runner认证、CSRF/Origin保留；同策略抵达enable/runtimeGET/admission/phase/reportEvents；旧tool路径保持；036在路由前且失败不继续启动。mock domain SQL只证明接线，真实PG/公开verdict/runtime/T7部署分别未验。AV R2最新caller失败、VAR实际尚待其前置，不据本片开启生产。

普通段：22:04:21Z–22:29:21Z，8MiB包含Git index/源码闭包/镜像/元数据和未来局部TMP/raw；初段0工程child，等本组local交接。完整预算与来源见 [segment](../../docs/evidence/x01-verifier-center-wiring/segment.json)。
