# 双中心往返：selected2实际通过，完整feature仍开放

执行 `291736984036d3a3d406561ace9b123fb6b5bcb7` / source `2f8cc1f61d32f518998a64d0adeec582f85481f2` / run `rectwocenter-20261007-110221-106064`。[13raw与外层原件manifest](two-center-first-manifest.json)；当前等待root实际独审，不自签整feature。

同一origin/context/baseURL/真实IDB下，通过公开Connect/ready身份A→B→A→B。A真实turn ACK丢失后原冻结key/body与下一稿保存，B列表不显示A记录、B无A命令/身份请求，A原始记录保持；B保存独立稿，回A显式Restore不POST、原key/body Retry得到同acceptedturn/task，最后回B显式Restore保B稿且A隐藏。业务POST仅A原turn及其原key replay。

旧A真实session GET被held后，浏览器实际取消：`abortedWithoutDelivery`、browserFailed=true、finished=false；这不是迟到成功被拒绝的实际证据。相同center只变principal、忽略abort的迟到ready由本次两项受控direct单独证明，不能冒公共rotation。没有新截图、真实runner/provider或其他旧journey重跑。

actual 2026-10-07T11:02:58.192378+00:00→2026-10-07T11:03:11.212374+00:00，outerexit0/stdout+stderr双EOF；outer 13019.487707992084ms、late 12459.486875ms、较早parent 12444.499792ms，保守charge13020/90000，余76980，旧phase未挪信用。初始化8723.231833ms，cookieRead1035.9202920000007ms，secondCenterCycle1634.7565839999988ms，仅本次计量不称性能改善。

两DB各自marker确认、before/after-marker零连接、正常DROP removed=true/remaining[]/errors[]，db-a/db-b原件独立；双center及fixture complete。fresh4PID+后三已知3PGID全ESRCH，scratchabsent，adminenv身份exact删除postENOENT未读值。outer自身PGID未单独记录，不补造；无独立port采样，公共HTTP与两center close由fixture报告接受。parent采样scratch峰27,502,789B，不是硬OS配额证明。共享窗已归还。

2026-10-07 11:07:00 UTC：root [独立实际审](two-center-first-root-review.json)接受本selected2与完整owned清理、0finding。原manifest审前state和所有raw保留，根报告不重写原run预算，不扩述整feature。
