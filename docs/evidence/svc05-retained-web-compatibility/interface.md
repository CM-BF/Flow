# SVC05R01 Interface

输入固定：backend root `personal-history-compatibility`，product `af51c621696230fbced12227670f014ca73bd8a1`；独立检查其实际apps/packages/tools/lock绑定，metadata HEAD变化不伪装源码漂移。只读两产物461a/b1c与caa1/8d8，精确root/manifest见inputs。d629不重跑。

| 模块 | Interface / 责任 |
| --- | --- |
| inventory | 仅显式两固定descriptor/root，逐文件大小/哈希/regular边界；绑定后台来源。禁止个人state/config/token读取、checkout/install/build。 |
| fixture | 一次真实af51 createServer + 单markedDB + synthetic公共runner/profile；按需打开/关闭一个artifact服务；运行/资源仅本owner。保存检查点后有限等连接零、核marker/devino再普通清理。 |
| transport | 有界观察公开HTTP；授权不入日志。仅中心已受理的turn ACK在真实headers到达后截断body，浏览器同Request response→requestfailed证实。显式恢复仍由App/用户动作。 |
| browser | 一个Chrome、两实际App context依次；DOM发消息/保草稿/Receipt unknown→Retry same message；读/发送/恢复/协商四固定report，加载资产字节绑定。 |

状态与错误：中心拥有命令事实，脚本不造幂等/任务状态；丢ACK不等取消。每App严格两次turn POST，原key/body/turn/task一致且中心仅一个turn；legacy GET通过只移除stream header观察，不变更App。缺件、权限、报告或清理未知均停止并保留，不能生成passed报告。

暂定运行边界（未获许可）：一个DB/center/runner、两个App顺序/一Chrome；90s工作+20s清理，raw8MiB/tmp64MiB观测阈值，fresh1GiB+128MiB且运行保持1GiB+64MiB；实际窗口由Lead根据源码和资源另定。所有配置凭据仅合成/内存并脱敏；checkpoint包含最小身份/失败/资源后才DROP或rm。不得清原只读artifact copies。

依赖：现有af51源/它的已固定第三方视图，Chrome和Playwright沿已审Web安装来源，仅resolve/hash准备；缺件提交精确donor需求，不安装、不指向moving main源码。动态SQL/跨包入口显式绑定。无新调度器/部署FSM，后续受管import仍用现CLI。

收口约束：PG观察每轮remaining query_timeout且晚回零仍unknown；停止周期采样后，whole groups停止及输出保存后，必须末采free/raw/tmp再checkpoint和清理。报告仅在清理成功后于own私有evidence调用固定import/verify，格式失败使最终outcome失败。
