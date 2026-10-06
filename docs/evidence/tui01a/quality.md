# TUI01A 方法与质量

2026-10-06 09:19:49 UTC：Node24/TypeScript/React/Ink，先本地find-skills、codebase-design、clean-code（固定bdacd76）、tdd；实际读assistant-ui以及固定139674dc的Ink、custom-backend、migration。官方llms.txt/docs/ink已读取；fixed tarball0.0.46 TextInput.tsx/d.ts实读，独立Box/useFocus/useInput/useTextBuffer，无runtime context依赖；不照搬useLocalRuntime。

单一中心事实、controller小端口、显式未知intent、两个真实consumer。工程测试不访问真实用户服务/凭据，fixture不冒provider。首scope规则/文档检查完成；行为尚未执行。


2026-10-06 09:35:40 UTC，交付前clean-code：命令descriptor只负责语法；controller集中本地状态/epoch/intent，中心业务经既有client；私有journal单独拥有原子落盘/锁；Ink与headless均消费同controller，无第二assistant runtime。测试使用公开ports、真实HTTP/自有随机PG、真实PTY。发现并修复：save-await后不能用已替换的signal新发POST；ACK-clear-await后不能重连旧epoch（两条red保留）；列表视图改为显式本地view且六项完整可见，避免打开会话后菜单被隐藏或一页中段不可访问。局部17/17、types0。大任务stream/queue/steer/附件/真实provider仍后继；不是OS凭据隔离或多设备journal。循环只有一个观察timer；未知不自动重试。未发现需在本片新增的通用抽象。

PTY驱动负结果保留：初文件名遮蔽Python标准pty；一次写命令+CR被当粘贴；等待raw/退出时未排空真实PTY输出导致backpressure阻塞。修正驱动为观察式ready、键入与提交分开并持续读取，未通过延长超时隐藏错误。真实终端最终发送/重开0退出、raw模式恢复、显示转义、后台继续均有独立原始检查。renderer focus需React act、tsx文件不被本库Vitest匹配，均记录为测试设施问题而非功能red。

2026-10-06 09:47:01 UTC，独审修复clean-code：按Mika两P2只处理错误settled与ACK边界。controller.dispose等待mutation settled（不让保存拒绝逃逸退出）；独立closeTerminalResources保证settle/unmount失败仍close journal，signal promise有拒绝处理。ACK解析/请求匹配抽成小内部模块，先验证再clear，不从未知200猜成功。新真实HTTP覆盖空create、错title及send原文/conversation/number/task错误→UNKNOWN→相同key/body显式恢复。延迟save失败与并发dispose使用真实私有journal，清理后能重新领取。新增8行为+原11controller共19/19、types0；不重原PG/PTY/renderer17全集。首7red保留；加ACK约束后3个旧mock不回显受理input而失败，已仅修fixture匹配真实合同（断言不减），保留consumer red。
