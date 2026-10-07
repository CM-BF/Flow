# Created-turn attempt：父监督器失败，原件保留

执行81f22/source67f8，`recturn-20261007-070121-4aa406` 07:02:04.923806→07:02:16.032817 UTC。worker cookieRead与createdTurnAckLoss两组断言均结束且failure/pageErrors为空；parent记录`Work deadline reached; cleanup reserve started`，actualexit1、selectedPassed=false、budget.complete=false。整体 **FAIL**，不改成case或feature PASS。

[11raw/27344B、外层与准入](continuous-fourth-manifest.json)保原件。wire为1 CREATE+2同key/body turn，同accepted turn/task；真实header→同Request ERR_CONTENT_LENGTH_MISMATCH，下一稿与0自动POST断言已执行。初始化7696.33625ms，cookie1004.508458ms、createdTurn1193.610917ms。实际outer11108.86075、late10498.352375、较早parent10488.9235，charge11109；新段47205/150000、余102795，旧封套64134.08675和五FAIL不改。

markedDB`flow_recovery_dc22e62130ae4d6bab7af1261e4a7b52`两观察0conn、正常DROP/removed/remaining[]；fixture complete/errors[]/provider0。07:02:32.422463 UTC parent7702/worker7722/Chrome7730 process+groups全ESRCH，scratch rnLtUk absent。outer双EOF；没有另做端口探测，HTTP关闭依据原fixture清理。manager07:03:25.810971 exact删除env未读值；[root独审](continuous-fourth-root-review.json)接受失败与owned清理，不接受case PASS。

可达源码竞态：正常finally先stopped=true后await已在途monitor；checkpoint在filesystem await后working()把stopped与实际deadline合并，能误记deadline。实际11s低于45s且无早资源异常，与此一致，但原trace无精确monitor交错，不能冒唯一动态根因。授权只修正常monitor退休、保持真实deadline/资源/late signal错误；先用可控barrier复现旧负例及新对照。新local段独立≤20000ms含5000cleanup，1Node、16MiBTMP/1MiBraw、0PGChrome。旧budget.complete=false原样保留，未来仅允许独立接受/精确hash/清理确认与11109charge的显式reconciliation；未知其他incomplete继续failclosed。

2026-10-07 07:06:39 UTC clean-code安全点：仅核原parent状态与检查生命周期，分开业务检查完成、整个attempt终态和清理。无产品改动，未重跑50/33/types或浏览器。下一PG已交C02，Queue只准备不预约。
