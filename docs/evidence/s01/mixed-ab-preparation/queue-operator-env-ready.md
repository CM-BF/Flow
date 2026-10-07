# S01 caller 环境与输出期限修复待审

Source `375ecccc427acf59d687153903bd032fb6e684bc`，基线 de6af442/packet289ce92d；原13:46:41独审为1P2 CHANGES_REQUESTED，正式[回执](queue-preparation-independent-review.json)保留。旧675/223/33SQL、旧input/ready/review与raw原字节不改。当前 **PENDING_DELTA_REVIEW / NOT_OPEN**。

只改新薄caller与5个pure seam反例：outer env-i/Python-I-B、inner同固定Python-I-B，git固定/usr/bin/git与显式无secret环境；Node execve仅literal PATH/TMP/cache/loader/Git配置和唯一授权adminURL，OPEN只outer读取不传Node；不枚举真实环境。两路Python都拒非isolated/dontwritebytecode入口。输出flush后同origin重新判300s；receipt/CLI打印前snapshot不冒称tool最终完成，阻塞仍需要外部真实时钟核算。无新监督器/DB/删除权力。

[新input-v2](queue-operator-input-v2.json) SHA `970f071eb7eb275145c81a6b6d0f6193ed5737c6e0a2b48051ada414f3819512`，增加固定Git/Python二进制绑定，原其余118绑定未改变。新source/record不覆盖旧input，禁止沿旧命令启动。未来实际命令只能在另授PG性能OPEN后使用：

```sh
/usr/bin/env -i PATH=/usr/bin:/bin FLOW_S01_ADMIN_URL="$FLOW_COORDINATION_DATABASE_URL" FLOW_S01_QUEUE_OPEN=s01-pool-wait-delivery-once /opt/homebrew/bin/python3.13 -I -B docs/evidence/s01/mixed-ab-preparation/queue-operator.py '<EXACT_EXECUTION_40SHA>' '970f071eb7eb275145c81a6b6d0f6193ed5737c6e0a2b48051ada414f3819512' '<FRESH_COMPLETE_FLOOR>'
```

此处变量由已授权私有入口加载，绝不回显/提交值；当前0真实PG/HTTP/performance。候选floor仍原9,125,888,000B等待future manager完整sum，ordinary小段另有floor，二者不互代。

必要检查准备为 `python3.13 -I -B queue-operator-env.test.py` 一次，5例仅mock subprocess/exec/print、合成env与clock；0真实环境枚举/子PG。覆盖毒化键丢弃、missing授权、fixedgit无secret、checkpoint→execve正确env、print跨期限return非0。当前未执行；manager条件允许独审通过后≤30s/至多2child各10s、TMP1MiB/raw64KiB，freshfloor≥7,686,258,688B，不能提前借此执行。原callerphase/deadline更大证明仍由静态review与现OPS14范围限定，不将本5例当真实PG准备全绿。

本段13:47:34Z开工，freshclaimv3/6与289ceclean；沿本地find-skills/codebase-design/固定clean-code，Interface保唯一授权配置、无ambient继承、错误unknown及同origin deadline。新源码与证据仅本合法scope。
