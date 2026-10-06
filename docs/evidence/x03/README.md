# X03 独立插件管理模块

实现 target `895c8999d22fb3d911de2d46969e37b40051fdea`；固定 base `8f1481df880cf5077e1ddb9a8f302fe700a7ece8` 已含 X02 和公共 client/CLI 095497。模型 gpt-6-astra ultra，独立worktree/claim见[领取回执](claim-receipt.json)。[接线接口](integration.md)已交WPF-CHAT01 owner。

模块只通过四个既有client读取方法展示当前scope的中心登记、修订、公开配置、grants、版本和审计，并通过host.list/subscribe独立展示本浏览器连接的可信扩展状态。未打开零registry读取；详情/历史按需，列表与历史每页10项、nextCursor翻页。registry分类grants/名称/版本不映射本地host权限或激活状态；不下载、安装或自动激活。

默认明确显示个人工作区登记；projectId由App已有选择传入，仅查询该项目。关闭、切中心sessionId或scope销毁读取生命周期，AbortSignal与迟到Promise拒绝同时生效；client方法通过对象调用保留this，client/token不传入PluginContext。刷新和分页保留按钮DOM与焦点，不主动focus其他内容；请求中保留上次可读数据并显示更新状态、防止重复导航。48字符公开配置键和128字符合法semver自然换行，无裁剪。

## 最终验证

[checks.json](checks.json)绑定七个源码/测试文件hash、所有退出码和日志。[browser-results.json](browser-results.json)实际sourceCommit就是895c8999，UTC **2026-10-06T04:16:17.584Z–04:16:24.201Z**，exit0，**12个命名浏览器检查**，pageErrors=[]、closeErrors=[]，两专用DB remaining=0；这不是12个Vitest用例。Node24.20.0、pnpm9.15.4，现有Chrome channel Playwright，0模型/新云/用户文件。功能运行在共享主机，时长非性能SLO。

- 真实中心HTTP与PostgreSQL，公开FlowClient登记11个人范围包、配置/grant/12版本与14审计，另有一个项目范围包和空项目；相同修订经真实中心重启仍一致。
- 中心B使用另一专库；只复制受控目标登记的四张plugin表记录制造真实同ID碰撞，再经公开client写入不同配置。此SQL复制只构造碰撞fixture，不声称用户API可以指定安装ID。
- 关闭0读取、个人/项目scope分离、列表10+1、版本10+2、审计10+4、详情/历史展开前无读取。
- 实际PluginHost的activate/disable/fail变化与registry runtime unavailable并行呈现；PluginContext无client/token/registry字段。fixture控制按钮是测试宿主的操作，管理模块本身只读。
- 401、503和transport connectionrefused经浏览器边界注入，明确错误和显式Retry；观测窗口无自动循环重试。它们是受控失败路径证据，不是生产网络故障恢复保证。
- 关闭以及保持视图打开直接换center，均取消旧读取；消费者故意忽略已完成HTTP后的取消并迟到返回，仍不能把旧center同ID配置覆盖新center。
- 刷新registry/registration和各Next page控件焦点保留；390px light/dark无横向溢出、键盘Space/Enter展开和可见focus。长key文本最右139.28125px未越过key列143.84375px，值列从153.84375px开始；长semver行文本最右360.40625px未越过容器366px。

实际查看[浅色桌面](module-light-desktop.png)、[浅色390px](module-light-390.png)、[深色390px](module-dark-390.png)。这是独立模块fixture截图；真实App入口尚未挂载验收。

类型检查：`node node_modules/typescript/bin/tsc --noEmit --project docs/evidence/x03/tsconfig.json` exit0；精确source/命令/UTC见[typecheck-result.json](typecheck-result.json)，04:17:13.041748Z–04:17:14.517156Z。空stdout不是单独证据，结果JSON记录实际退出码。[依赖解析](dependency-resolution.json)证明@flow/client/contracts来自本固定worktree，而非滚动main源码；仅复用已安装外部依赖，未改lock/版本。

## 失败与纠正

| 记录 | 实际结果 | 处理 |
| --- | --- | --- |
| browser-red | exit1，2前置检查后列表断言失败 | 空模块按预期不能显示公开client登记；实现读取后first-green exit0、3检查 |
| typecheck-initial | exit2，vite/client类型入口找不到 | 局部配置只需node类型；随后发现缺noEmit产生派生JS |
| typecheck-emission-correction | 68个派生JS曾出现，原有tracked源码未改 | 按新增文件与对应TS逐项删除，模块两派生JS由c2c1201删除；显式noEmit和配置双保险，最终范围无生成JS |
| browser-full-first | exit0，10检查，两库清理 | 历史片段，不能替代后续扩展后的结果 |
| browser-cleanup-failure | exit1、PG57P01，未写final JSON | 强制删除自己的临时DB与连接关闭时序冲突；具体pool身份未确定，不断言pg-boss根因。保留code/message/stack摘要，PG内部client对象/瞬时取消key不入证据 |
| cleanup-recovery | remaining=0 | 只读核自己遗留库无连接后正常删除，仅清自有资源 |
| browser-focus-red | exit1，Next registry page消失使键盘焦点断言失败 | 保留按钮/数据、取消页组件key重建，最终12项覆盖修复 |
| browser-candidate | exit0，12检查 | 已覆盖长值/焦点；最终再具体加入401/offline并绑定895c8999执行 |

fixture收尾现在逐一记录关闭失败为exit1，仅对自有数据库有界等待连接归零后正常DROP，不使用FORCE、不吞pool错误、不停止他人服务。最终两库关闭观测连接为空，remaining=0。所有失败/退出码保留，不覆盖旧JSON假报新轮次成功。

## Review 与剩余验收

Mika独立review **APPROVED** target895c8999，读全部七文件与修复diff、focus-red、最终12检查原始日志/结果和三截图，七文件working bytes与target一致、diffcheck通过；无未解决blocking findings，未重跑浏览器。详细记录见[review](../../../plans/x03-plugin-management-view/review.md)。

**X03-04待WPF-CHAT01 owner挂载真实App，再验真实入口的开闭/中心切换/两主题/390px/键盘。** 本模块fixture不代表App已完成；main尚未接收X03。工程架构target为新增管理视图的public client读取与本连接host只读快照边界，Execution Lead在接收时同步固定基线。唯一进度事实源[status](../../../plans/x03-plugin-management-view/status.md)，claim在review/集成期保留。
