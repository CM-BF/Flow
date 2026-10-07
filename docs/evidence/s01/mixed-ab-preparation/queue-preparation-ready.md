# S01 queue delivery 完整输入与薄外壳待审

Source `de6af442b03533d48e5cdca7b9d6e2bde4229f2f`；固定生产 `4fdd856293a502209d7509ea37da901bbfd89f72`。本片 **SOURCE_PREPARATION / REVIEW_PENDING / NOT_READY / NOT_RUN / NOT_OPEN**。本段 2026-10-07T13:43:41.265Z 封存前仅源码与静态清单，0工程检查/PG/HTTP/provider/源码导出。旧已审 delivery/wiring/legacy DTO 与旧 raw 不重审、不覆盖。

唯一输入 [queue-operator-input.json](queue-operator-input.json)，SHA `5a02b95fdc450c94859bd9609646d64e6fe50eed91610309d82e3492adfcd2e5`。新claim508f v3/6范围已COMMITTED13:34:26.938Z；新pool-wait-run已合法领取但目录尚未创建。原五范围保留，未release/re-take。

## 精确输入与差异

- 导出superset675文件4,931,265B（含未运行test）；固定Git cat-file输出4,966,472B，低于原12MiB buffer。实际保守AST闭包223源1,118,438B，含type-only，不能当均已执行。
- SQL外部33项全部齐备：002与004–035；001/003内联，pg-boss自有DDL不冒作这33项。已核动态012/013、017/019与007/035数组。
- 16既有外部依赖manifest、pg8.23.1/pg-boss12.37.0与六runtime文件、Node24.20/tsx4.23.15/esbuild0.28.2及31loader文件已绑定。不声称整个node_modules每个传递文件均锁定；未来fresh复核realpath/manifest/已列bytes，不安装。
- plugin host的computed import只在显式pluginExecution启用；此recipe未提供该authority，v2claim+fixtureadapter，不调用插件/provider。
- O1/O2共用一个固定生产目录，唯一主动变量为SQL观察per-query/buffered投递。原A/B默认不变。新process.ts仅pgDelivery子进程禁用tsx磁盘cache，源码已核本地版本支持；不能把Map cache当heap配额。

## 入口与生命周期

新 [queue-operator.py](queue-operator.py) 只消费既有OPS14；受监督child先wx耐久PID/PGID checkpoint再samePID exec，原driver/child负责各专库/port0/journal/source-root。外壳无DB/drop/rmtree权限、不复制监督循环。未来只有明确OPEN后私用既有env加载、映射FLOW_S01_ADMIN_URL（绝不打印值），命令固定为：

```sh
FLOW_S01_QUEUE_OPEN=s01-pool-wait-delivery-once /opt/homebrew/bin/python3.13 -B docs/evidence/s01/mixed-ab-preparation/queue-operator.py '<EXACT_EXECUTION_40SHA>' '5a02b95fdc450c94859bd9609646d64e6fe50eed91610309d82e3492adfcd2e5' '<FRESH_COMPLETE_FLOOR_BYTES>'
```

不得替换成movingHEAD。开前fresh v3/6 owner/WT/branch、origin/clean、全部输入、五caller输出与pool-wait-run根absence、共享holder交还、localhost集群/WAL文件系统与完整资源合计均需确认。任何未知HOLD不spawn。

原300秒/512MiB：15秒prep、各135秒240MiB、共同32MiB含最终4MiB；O1失败或cleanup未知不启动O2，O2须剩余150秒。新外壳从Python模块origin到295秒work/2秒stopdrain/3秒持久化，不把未观测的tool入口/返回时间含进内部clock；实际还须外部whole-tool计时，超界如实FAIL。新raw256KiB及收据计入原4MiB最终reserve，不另加第二reserve。

每侧129tasks（合成已完成chat1+128fixture），总258；HTTP每侧8192=owner512+runner7680，轻读≤200/2inflight，固定四取消；center8+scheduler3+driveradmin1+observer1=13连接理论峰，两侧串行。6秒measurement与≤5秒活动尾分开，signal/ACK/持久终态各自clock，不把acquisition等同纯排队。

候选floor **9,125,888,000B** = 当前manager下限7,515,275,264 + 实验512MiB + 额外DB/WAL调度headroom1GiB。此额外1GiB不是重复cleanupreserve，不是WAL实测/硬cap；future完整sum由manager按当时实际holder/KEEP确认，可能更高，当前无OPEN。历史5,663,621,120等不是现时准入线。

## 尚缺的最小解除条件

1. 新外壳/缓存delta独立只读审；不重审旧通过模块。
2. 申请另一个ordinary纯检查段≤30秒/最多2child各10秒、TMP1MiB/raw64KiB，仅新caller phase/receipt/early-failure反例与必要语法。此申请未授权/未执行，不继承旧ordinary归还。
3. future固定execution HEAD与完整资源/PGWAL preflight、新独占性能OPEN；输出清单与原资源KEEP均保守。

质量：沿本地find-skills/codebase-design/固定clean-code，明确薄caller与driver资源所有权、固定输入及未知结果；没有新通用平台，0旧unknown根访问。本片不是真实性能、用户轻读/取消或最新main验收。
