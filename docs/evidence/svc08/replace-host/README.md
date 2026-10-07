# SVC08 同锁 Web 宿主替换局部交付

Source: `52d3c80bbb2afc7c6dc179e7dc8d867c15d1ee13`。四产品路径相对固定 main `0967607a9a9c2435282ca7fbba23b6e96df096c4`；两个只读叶子先以独立input-only commit恢复，见controlled-source-input。当前工具真实读取legacy配置，合成state.source固定af51；没有复制历史工具分叉。

10个不同检查分轮：首9/9（19c9），新增精确retained report反例1红（d6c6），最小复用修复后3/3（52d3，1新+2相邻）。不是一轮10/10；共13次执行，12次通过。三轮监督共1744ms，原6个PG用例未选，不重跑旧proxy/fullbuild。每轮stdout/stderr、reservation、result、cleanup及工具退出来源独立保存。

真实进程仅监督测试进程/无效请求的CLI子进程，服务由受信测试端口注入。三组最终absent、双EOF；自有13个fixture和3个外层scratch均正常清理。失败轮fixture bytes=0表示异常前未执行尾部计量，不声称峰值0。旧EPERM观察保留，不覆盖最终absent事实。0 PG/Chrome/provider/个人服务动作。

接口见interface.md。精确release report/backend关联、全部保留资源/namespace/budget校验复用loadReleaseAssets，先于Web停止；新操作journal先持久，unknown不重启、换ID不能旁路；同ID只观察结果。原bootstrap/publish/rollback默认端口不变，本次未执行其PG路径。

Host仍由backendRuntime选择：无backendArtifact时config.repository，有时是已验artifact。八文件digest只记录明确源字节，不冻结目录、不证明全部lazy依赖已载入。真实legacy部署仍需固定源窗口、旧backend继续运行时动态读取边界、实际私有身份/marker/兼容输入和独立操作许可；此交付不授权个人切换，不证明长期稳定或64CLOSED个人根因。retained3另留后继。
