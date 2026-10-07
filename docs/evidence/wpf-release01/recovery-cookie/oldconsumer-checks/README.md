# 旧7272消费者最小两文件落地与必要检查

固定源码 `d736547e1bd5a7acc256dd0c4c863d5a2bbe2fb6`；产品patch `1cea1ce62ea2c10eaeb8fccdb35fe6f5d81aa804` 恰两file12+/4-，hash802e/728a逐字等已审TMP。其余Web/client/contracts/interaction保持7272，两个release harness逐字8964。

[固定范围](source-manifest.json)、[原单场景来源](provenance.json)、[封存索引](archive-index.json)、[所有原件索引](index.json)。新段90秒已CLOSED，累计6165ms/未用83835，不触发后续运行。

- noEmit：真实两产品+实际单场景，strict/noUnchecked/noEmit，outer0/tsc0，2844ms；不重复8964harness检查。
- direct-1：未选中测试，缺`@flow/interaction/activity` resolver导致真实FAIL；原件不改。
- direct-2：仅补本树既有activity入口，原测试/产品不改；outer0/child0、恰1 file/1 case、0skip/todo/fail，1505ms；首红1816ms计入。

复用c848已审单membership场景和受控IDB事件端口，production全部导向本树：B-only durable refs、当前A优先、unverified有序材料、部分/完整显式恢复、detached inTransit排除、旧port晚cleanup不清新port。不是浏览器IDB、mounted App、真实HTTP或整个MSG矩阵。JSON的2 suites是describe+file计数，实际testResults仅1file/1assertion。

三个outer/Node进程及其PGID均已fresh ESRCH，三个owned scratch均删除；日志采用regular files无用户态丢弃器，终态在组退出/写端关闭后读取。原件保留privateTMP；未来新run不能借未用额度。

构建仍未运行。既有`tools/personal-preview/web-artifact.mjs:prepareWebArtifact`以真实cleanHEAD/lock/toolchain构建及校验全dist；本树尚无builder用的node_modules解析，测试只用了TMP只读aliases。后续须供应受控外部依赖resolver，@flow必须指本树，不能整借donor @flow指向其他源码；不得安装或自建第二builder。

clean-code：复用唯一membership selector与真实旧session getter；无复制authority/store。实际发现并修复一个验证resolver漏项，保首红。源码/局部结果待独立集中review，artifact/新pair/发布未验。

Root集中独审已[APPROVED](root-source-local-review.json)，固定d736三scope；源码与必要local范围通过不替代build/browser/immutablecompat。两生产literal已STOP，精确账本移出回执另列。

两产品[STOP声明](product-handback-stop.json)与[实际amend](product-handback-receipt.json)：v2仅保两harness和两records；不恢复已交回产品写权。
