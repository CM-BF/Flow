# ENG01C 固定交付证据

固定source：1fd70c28ac60878e132c9f28a00e381ec6fcc533；base648e331c58043cf7ee307300521ab1c628cb2ee1。仅6个源码/直接测试文件，writer只拥有有限lease输入；v1合同、profile canonical/hash、workspace/checker/runtime/outbox源码保持。未独审前不称main具备本改动。

50个不同检查分轮：local.stdout 44/44（writer16、workspace18、setup10）；pg.stdout 6/6，其中typed unknown与普通异常两路都checkerCalls0/reservationHeld/journalRetained，重启writes仍1；成功和checker失败、lost artifact ACK及旧text/错误目的拒绝保持。原ENG01B 123未重跑。PG随机库经afterAll正常DROP，pg-resources.json databaseRemoved=true。设置直接消费者包含受信fixture的一个新Node进程恢复检查；没有native/app-server/provider。

writer-red.stdout保留初始15 failed+1 passed，旧实现忽略结果/异常误释放的真实行为红；不是0测试加载失败。第一次types.stdout exit2仅新mock的version字面量宽化；最终只加as const及测试标题语法修正，行为/断言未改，types-final.stdout exit0。原local44在该无运行影响的类型修正前执行，未因此重复跑44。安装固定Node24.20.0/pnpm9.15.4，offline frozen lock成功，自有WT依赖，没有全球SDK/@flow跨分支替代。

实际命令/exit/time均见同名前缀JSON，stdout保留。单次本地样本：local测试8.71s，PG测试4.21s；PG成功样本719ms、checker38ms、artifact3265B、diff630B、4文件。它们是有界行为样本，不是比较基线或整体性能改善。没有新增缓存/调度器/无限队列。

限制：typed stopped是受信writer对自己拥有操作的报告，不是OS停止证明。现production只固定单次await writeFile，无child/background；generic throw全部unknown，不按Promise结束归类。测试中的后台work只是受控注入，不能证明真实native后台停止。A无task/attempt身份新增（HarnessContext不提供它们）；native后继仍需真实身份seam、资格和可核完整停止，以及checker同进程import/伪JSON/exit漏洞的执行前约束或host独占断言隔离。0provider，不扩大fixture批准范围。
