# X03 技能与质量

2026-10-06：stack React19/TypeScript/Vite8、公有FlowClient、可信PluginHost、Playwright/PG。按find-skills本地优先方法，沿用本地find-skills、clean-code（sickn33固定bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5）、codebase-design、brainstorming、tdd；本段完整读取frontend-design、vercel-react-best-practices、webapp-testing SKILL.md，均位于/Users/citrine/.agents/skills/，未安装依赖/技能。

实际应用：沿既有设计token与字体，紧凑可读行与按需详情，避免无意义新视觉系统；只读publicclient与host窄接口，不复制DTO/映射权限；独立读取并发、不提前读取未打开部分、关闭/切中心取消与迟到拒绝，useSyncExternalStore读取真实host。测试以公开边界与真实浏览器/PG为主，Node24/Vitest4固定工具版本。已有Node Playwright与动态端口生命周期可直接复用工程模式；保留webapp-testing的DOM核验后操作、headless截图、错误采集与自有资源清理方法。

2026-10-06 04:17 UTC工作段/交付clean-code复核：生产三个文件，读取生命周期集中useRead，小型展示函数沿真实职责拆分，DTO直接用contracts/host，不做grant→能力映射；取消与错误处理保留旧数据但拒迟到，错误不伪造空数据；分页10条替换。独审发现的焦点卸载、长合法键/版本换行均以浏览器断言修复。无主动focus抢占、不用overflow hidden掩盖长值。外部依赖/锁未变。

资源纠正：局部tsc曾漏noEmit生成68个派生JS，已逐项撤销并保留审计；强制DROP临时DB曾触发57P01，确切pool身份未确认，改为自有连接归零再正常DROP，关闭失败仍exit1，不改共享server。最终12项真实PG/HTTP/host浏览器检查和类型检查通过；未扩大为App入口或性能/容量结论。
