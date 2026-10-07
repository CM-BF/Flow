# ENG 后继：真实只读 native factory + 唯一 host 写 FD

本页是原ENG-001的下一小片范围候选，尚未领取新增产品/运行。K source42905已审且冻结；J f15/de1机制与stock helper结果已main，但不是原生动态工具调用。本候选不改变旧locked-no-fallback grant，用户资格选择仍由J唯一status记录。

## 小Interface与复用

1. 在现J Darwin profile职责内提取固定startup recipe的共有展开，保原helper byte行为；新增`createStockReadOnlyProfile({startupRecipe,directory,runtimeDirectory})`仅让私有runtime可写、workspace可读。它不追加calculator写allow；复用已获审e7ff/9b9c配方与binary摘要，不逐名猜sysctl，不放开network/fork/Mach、不采用network-all。原`createStockHelperProfile`保持原调用语义。
2. 在现J host职责内新增`prepareDarwinReadOnlyHost`，复用私有目录/文件身份、binary/sandbox摘要、一次take和R06三pipe配置。固定stock argv为`app-server`（不是fs-helper）；只创建现有R06 transport，initialize.experimentalApi=true，固定sandbox-exec外层profile、private HOME/CODEX_HOME/TMPDIR、显式环境且无个人认证。prepare无spawn；createTransport单次，校验cwd/目录/二进制/策略身份，未知spawn不复投。新函数不产modelAssurance或writeAccess=revoked。
3. 新`prepareTrustedToolHost`组合上述factory、K的`openCalculatorToolFile/createTrustedToolWriter`和已有recipe；固定task/attempt/runner/ownerVersion/lease/baseCommit/generation、canonical workspace与calculator inode。先当前ownership，再开唯一FD/准备host，再复核；失败保留已取得资源并走同一close。工具参数不能提供目标路径或新授权。组合返回既有createTransport、writer/recipe及close；不自行startTurn、不新增executor/receive loop。
4. close同步seal写gate，关闭现R06通道并真实等待host在途write/fsync/FD close。结果分别报告local child与hostWrite，nativeWriteAccess继续unknown。原生进程无workspace写FD；唯一本次host gate入口取消后不可重开。在途无法收束、source/FD/identity未知，保持lease和unknown；直属child/组消失不替代host真实settle，也不声明Unix用户所有潜在能力撤销。

## 精确候选scope

| 路径 | 原归属/实际变化 |
| --- | --- |
| apps/runner/src/engineering/native-authority-darwin.ts | ENG01J现claim；共有固定recipe展开与新只读变体，helper原输出保持 |
| apps/runner/src/engineering/native-authority-darwin.test.ts | ENG01J现claim；只读profile不含calculator写、旧helper稳定直接用例 |
| apps/runner/src/engineering/native-authority.ts | ENG01J现claim；同一真实R06只读factory，无第二transport |
| apps/runner/src/engineering/native-authority.test.ts | ENG01J现claim；source/FD身份与一次launch、open失败收尾直接用例 |
| apps/runner/src/engineering/native-tool-host.ts | 新小组合叶子；唯一FD/readonlyfactory/close所有者 |
| apps/runner/src/engineering/native-tool-host.test.ts | 新直接consumer；ownership失效、部分open、在途close/unknown |

另新片own plan/evidence两literal，ID/WT/base由Lead在K main receipt后固定再fresh take。J旧owner先停上述四路径并amend移出，再新claim领取；K六产品于mainreceipt后交回，只作为只读输入，**不续写shared exchange**。不改R06、G/I、contracts、C02或旧profile/grant。无需新依赖安装、sandbox框架或Linux镜像。

## 验收与未获运行许可

先纯profile对比与注入factory/私有FD组合，用现OPS14、显式直接用例与focused types。随后独立固定一个零query准备：实际stock app-server只initialize/close，不thread/start或turn/start、不model/list；必要受控canary只验证派生FD不含host FD、workspace拒写/私有runtime可写，不能称全IPC proof。真实启动/OS验证需固定输入和下一有界local授权后执行，本页0运行。

由真实model产生item/tool/call仍需后续明确provider预算/资格合同，当前不能用模拟回调冒充。stock initialize、目录、requested配置都不升级actual model；不能为测试调用额外资格query。当前固定recipe被复用的启动资源与Mac服务只能按已有范围主张，不能笼统当所有委托通道已封闭；完整工具能力与资格仍需独立证据/产品裁决。

## 替代与代价

Linux专用cgroup/namespace域保持备选；Root只读Docker Engine29.4/linux-aarch64/cgroupfs v2可访问事实不提供专域控制权或all-writer撤销证明。本片选本机readOnly native+host唯一文件gate，避免为已存在R06/tool协议另造executor；不把新的媒介写入方式伪装旧native fileChange recipe成功。
