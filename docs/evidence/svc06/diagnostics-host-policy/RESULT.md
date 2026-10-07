# 新诊断宿主r1：发布fixture首错，清理已确认

实际work失败，不能当完整宿主策略验收通过。唯一调用10:25:06.904025Z；work结束10:26:04.686Z/57,759ms/exit1，最早持久错误`WEB_RELEASE_BOOTSTRAP_REQUIRED`，checkpoint仍`start-default-off`。

新7d1/6c原模块已启动三角色，defaultOff=true；旧factory正常close、已取消自有turn与27迁移、后继35迁移均已记录，旧代表列摘要/idle断言在release失败前已通过（源码顺序推证，未另保存after摘要）。原r1 runner问题本次未重现；不能据此声称已确定或修复旧首因。0provider/个人操作。

[只读诊断](DIAGNOSIS.json)：原journey在无web-release.json时以expectedVersion0/action=publish初始化，固定产品要求bootstrap，因此保护正确拒绝。下一最小修正在新fixture分支只改初始action，不能放宽产品/覆盖指针。此次已消费namespace不重放。

独立cleanup于10:26:05.098Z结束/393ms/exit0；work37787、cleanup76776最终absent/双EOF，无signals；原helper确认center50116、runner57417、Web63886全部stopped。匹配nonce exit0/0/1，Web1是显式停止的收尾观察；三个stderr均0B、完整、hash匹配，未输出任何raw内容。缺少后续generation保partial-unknown，初EPERM观察保留。

work终态先持久且writer absent；专库marker/OID1282326/有界连接[]/normalDROP remaining[]，无force。新artifact/private根/旧c2c/r1及全部诊断保持，窗口已即时归还。后续policy guards、维护refresh/resume、cookie HTTP、真实三App/个人均未完成。

[结果与保留身份](result-analysis.json) / [outer原件](host-policy-outer.json) / [字节原样副本](actual-r1/work-result.json)。仅本次结果待独立忠实性审查；不重build/import，不重试副作用。
