# Producer 已批准设计：受控基准同步请求

Mika已只读批准设计 `37f1385b78e79179f15162e1c90a4706d30aa1ab`，0设计P1/P2；这是设计方向批准，不是实现或真实SDK批准。2026-10-06 11:59:16 UTC fresh核main/origin `2f4a5789ee13937914fa2c25161c8d5ed1071550` clean、owner `37f1385b` clean、原v7 ACTIVE且四候选无writer。随后[原子amend回执](producer-amend-receipt.json)在11:59:22.900 UTC COMMITTED为v8：四个精确源码加原两个metadata目录。尚未修改源码、同步main、执行测试或SDK。

## 必要输入及最小同步方式

| 边界 | owner树缺少的已审公共行为 | 处理 |
| --- | --- | --- |
| `packages/contracts/src/runner.ts` | context-observation union、冻结executionIdentity；同一已审版本还包含engineering verifier分支 | 整体采用固定main，不复制/重建union、不移除其他已审分支 |
| `apps/runner/src/runtime.ts` | 注入冻结executionIdentity，且包含已审正常stop claim drain修复 | 整体采用固定main；沿现unknown settlement与outbox，不写runtime |
| `apps/server/src/events.ts` | 原ownedAttempt事务挂历史store；同一版本还包含engineering完成门禁 | 整体采用固定main，不能仅摘观测行造成import/合同缺口 |
| 直接消费者的静态import闭包 | runner/claude及既定runner测试可达78个TS文件，16个相对owner不同；包括contracts/index/runner/tasks、engineering/profile、attachments、conversation合同、goal-delivery、client/index/ACK，以及Codex adapter/turn | 精确差异路径/hash见[同步输入](producer-base-sync-inputs.json)。这是静态依赖证据，不是16文件手工覆盖授权；server动态行为不能只按import图背书 |

**建议同步动作仅一个：** Root确认后，另取同task、同WT/branch的`role: integration, scope: []`，以独立稳定requestId得到COMMITTED，再将已审固定main `2f4a5789ee13937914fa2c25161c8d5ed1071550`整体合入当前owner分支。使用正常受控merge，不reset/cherry-pick叶文件/复制共享实现；任何冲突立即停止，不手工解决。记录before/target/result、18旧源不变、共享入口等于固定main、无额外实现，并释放integration role；writer v8保留四源码与metadata。最终仅在四已领取路径实施已审设计。

只读legacy `git merge-tree`的merge-base为 `8d8ab520a9d43c7b9dafb22911416ee799ebf665`，exit0、无冲突header/marker，未动index/工作树；这不是实际merge成功承诺。当前claude、c173 helper、settlement类型等14研究输入均已由Mika核与固定main相同，优先避免对旧18源再次写入。

owner树没有node_modules。实现验证可延续既有临时配置，复用主仓固定Node24/pnpm9.15.4/Vitest4.0.18及已安装第三方包；所有`@flow/*`别名必须指向**同步后的owner源码**，不能误测main实现。根tsconfig/Vitest与runner/client/contracts package manifest相同，lock仅主线其他已审依赖增量；不安装、不建源码目录symlink、不改锁文件来绕闭包。若实际类型依赖不足则报告，不能造声明或放宽strict。

## Root补充的实现验收（已接收）

- **跨kind安全加和：** 旧c173 normalize只核单kind，used/free/buffer各自safe而总和溢出仍可能返回。新read helper须复用正式`contextObservationPayloadSchema`对应有限字段校验（可从现schema派生pick，保留superRefine或直接校验完整有限候选），在measurement边界识别为`unavailable`；不得拖到emit使成功task失败，不修改c173，不把ownership/session/emit放进该catch。验证要同时覆盖各kind合法但总和越界及deferred不入该数学。
- **pre-abort与pending-abort分开：** helper入口signal已aborted则0 control调用，沿原取消传播，不是“已发pending unknown”；只有确认开始调用后尚未settled时的abort/deadline才进入unsettled。同步throw/明确reject只unavailable；竞态要通过确定性fake Query断言。
- **finally优先级：** pending unknown先留下本次局部标记，执行既有abort/close；即使close throws，最终仍抛同一`NativeExecutionError('unknown')`，不允许普通cleanup错误降级为failed/completed。非unknown分支不吞原ownership/emit/fence错误。
- **首次成功result候选不是发布许可：** 继续原stream；后续冲突、stream-error、session/resolved identity变化时永不emit候选，不重采。只有正常EOF、原最终结果校验与ownership通过后才发布一次历史观测；同Query/init resolved身份与requested alias保持分离。

本页为现有设计的依赖/验收补充；旧设计和14源输入保持原字节。等待Root确认上述固定main同步动作，0source/测试/PG/SDK/provider。尚无current、remaining、compression或Web交付结论。
