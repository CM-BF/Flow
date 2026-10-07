# WPF-DASHBOARD-ACCESS01 · 从工程看板打开 Flow 与取得本机连接资料

创建：2026-10-07 02:53:01 UTC；最近更新：2026-10-07 03:26:34 UTC。状态：in-progress。
所属大task：[D01](../../../execution-dashboard/plans/d01-execution-dashboard/plan.md)。co-lead：Web /root（执行管理 d01_owner）。唯一 owner：workspace_panels_owner / gpt-6-astra。

用户结果：4320 保留真实 Flow 61228 入口与非敏感连接说明；本机明确启用后，由用户主动加载、查看/复制 owner token，空 Center URL 使用产品已有 /api 代理。用户 tab 不被自动刷新或登录，center/runner 不在本片控制范围。

遵循[模块化规则](../../AGENTS.md#modular-design)。固定输入943a66bfa5f71f4a5000ff2674ac1973e85e0353；[Interface](../../docs/evidence/wpf-dashboard-local-access/initial-interface.md)及[root 可信来源](../../docs/evidence/wpf-dashboard-local-access/trusted-source-design.json)。

## 冻结约束与 Module

Node built-in local-access Module 只读取启动时绑定的唯一安装config.json：显式 opt-in、可信目录/identity、no-follow descriptor/type/uid/mode/大小、仅ownerToken投影；不得导入个人 launcher。描述与显式POST分离，exact Host/Origin/loopback peer/Sec-Fetch-Site/custom header，no CORS/no-store。默认及remote部署禁用。错误必须在现server通用error.message catch之前转成固定安全错误。

独立public JS/CSS承载masked/show/hide/copy与generation/abort生命周期；无token进入Git/status/aggregate/URL/log/static/storage。真实凭据验收不录DOM/截图/trace，仅安全布尔结果。框架、共享App、registry/aggregate/app.js、Recovery不改。

## TODO

- [ ] ACCESS01-01：固定配置provider与HTTP授权/错误路径。
- [ ] ACCESS01-02：真实入口、连接资料、显隐/复制与键盘/主题/窄屏。
- [ ] ACCESS01-03：合成凭据Module/HTTP定向检查、受控真实UI验证。
- [ ] ACCESS01-04：固定源码独审与修复；受控main及4320发布/原tab保留验收。

## 当前验证条件

源码08ec+35direct已获限定独审；两次隔离browser均4/5组通过但整体FAILED，第二次未进入真实hidden状态。原60s保守余41272ms含15s清理；当前无第三次运行授权。普通定向检查按一个有界工作段执行，失败保原raw并定向修复；真实浏览器与服务部署须独立隔离。无新增依赖或安装。main能力、fake fixture与真实安装验证分别记录。

完成条件：四TODO都有对应固定实现/检查/独审/集成部署事实；不因source完成提前标整个用户结果完成。架构影响：dashboard新增默认关闭的本机凭据按需读取能力；待D06原owner后继更新，不编辑图。
