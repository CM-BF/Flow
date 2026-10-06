# K02 冻结知识上下文领域交付

固定实现 `a6c9b09a8a4d4020a497341d3fb6deed16b08d02`，base `fb906cb42391971a8b315dbd813f7633927d7265`。已实现新对话固定project、发送/排队原文冻结、同事务budget/绑定、公开metadata、私有claim输入和两种受控retry重编译。当前只交领域模块；生产自动挂载、shared client/CLI、Web和原消费者组合由对应owner接线后另验。

23个不同模块用例由 final-matrix 19/19、integrity-extra 3/3、session-budget 1/1组成；delivery-typecheck明确Node24 tsc --noEmit exit0。后4项仅追加测试，前19 bodies逐字前缀匹配见test-prefix-proof.json，产品源码在三次检查不变。命令、实际UTC/exit和全部源码hash见manifest及各result，不将较早片段重复相加。12次自有DB最终remaining[]；全部动态端口、正常关闭/DROP，未触共享服务。

覆盖真实HTTP：发送取消response body后幂等重放/restart；source更新后queue自动提升仍旧字节；pause/cancel/显式resume/replay；跨project、坏digest、UTF8字节边界、重复/五引用、超总量/编译budget回滚；公开task/bubble/turn/queue与初始SSE无私有原文；owner detail双ID/runner403/未认证401与实际JSON预算；不可变source input与不可清空绑定；坏raw/contextDigest/compiled/inputDigest回滚attempt，原生session reservation也回滚。两个retry策略保留contextDigest、重算inputDigest且保留原C02 stop/安全/大小门禁。最大8192B合法引用精确保留。实际runner+Claude adapter只注入query，收到完整中心compiled，0模型/云；digest不覆盖adapter后来追加的material路径。

新queue列表50个context仅1次metadata SELECT；4个citation仅1次bounded version/head读取（另有project存在性读）。实际列表响应46,816 UTF8B是此固定样本，非通用硬上限；每source metadata有界且SQL显式allowlist，不返冻结正文。详情raw<=8192B且JSON.stringify后<=65536B。见final-matrix-bounded-reads.json；没有另跑performance benchmark，不声称PG wire或性能收益。

保留失败：context-red旧schema400；context-green因JSONB键排序使字符串重编译不一致，已改canonical；queue-red未冻结metadata；retry-red旧retry未计入冻结材料而错误接受超限输入。早期context/claim result仅4已知路径，未采样当时未跟踪test/helper，不能据此单独绑定完整实现；后续记录真实tracked+untracked范围。完整最终source集合21项包含test/fixture/check.mjs与已移交两runner seam。

claim347d4777 v2 ACTIVE；两runner路径从7368497起停写交O07，其余17范围继续保留review期。架构新增context/input authority和privateclaim投影、生产migrate/register待Lead同步。Mika独立技术review未完成，Goal Owner产品验收未接收；不提前把模块fixture当产品生产入口。
