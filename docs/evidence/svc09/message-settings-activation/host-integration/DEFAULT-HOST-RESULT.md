# 默认三角色实际结果

一次实际运行仍在中心 ready 阶段失败，默认三角色闭环尚未通过。固定 source 62373492 / artifact 2515、source098b 与已审控制器未改变。

- START 2026-10-07T19:16:09.120Z；operator 29,140ms、exit1；实际 RETURN 2026-10-07T19:17:35.003Z。
- 首错 host-consumer / START_UNCONFIRMED_CHECK_STATUS。新直接观测为 center ready 67轮/10,104ms，末次 owner=running、listener-query exit1/owned=false、listenerCount=null；health 因短路未执行。不是中心底层根因结论，也不能将 null 当作已测零监听。
- 只创建 center48884；runner/Web未创建。原控制器停止与独立cleanup均核该身份 stopped，6个本次PID及4个实际自有组最终absent；受监督流双EOF、无signals。
- 独立cleanup exit0，launchAccounted/resourcesClosed=true；marker/OID1348911匹配，连接empty、adminClosed，tasks0/attempts0。DB和私有目录KEEP，mayDrop=false，未DROP。
- 原R1–R4失败/KEEP不动，0provider/Chrome/个人；不重试。初始EPERM/unknown与最终absent原样保留。

原始记录仅存一份于 actual-default-host-once 与 default-host-outer-once；派生分析见 default-host-result-analysis.json，精确运行归还见 default-host-window-return.json。wrapper stderr为0B；本次结果未读取detached服务私有输出。独立结果审查待完成。
