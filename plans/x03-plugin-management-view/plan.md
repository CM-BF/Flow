# X03 插件登记与本浏览器状态

创建：2026-10-06；Owner b01_bounded_reads（gpt-6-astra ultra），Lead mika；阶段M2。固定base 8f1481df880cf5077e1ddb9a8f302fe700a7ece8，已含X02/公共095497。采用已明确授权的独立只读模块方案，不改App/session/host/shared/index/lock。

用户收益：读懂中心登记的版本、公开配置、授权分类及修订审计，同时看到当前浏览器连接里可信扩展的真实运行状态。两部分保持独立：登记名称、版本和renderer分类grant不能推导本地host能力/运行状态；没有包下载、安装或自动激活。

窄接口：PluginManagement接收open、sessionId、registry（Pick<FlowClient, plugins/plugin/pluginVersions/pluginOperations>）、runtime（Pick<PluginHost, list/subscribe>）；DTO沿用contracts和host类型。关闭时不挂载读取子树，切session重新建立读取生命期；每个异步读取有AbortSignal和迟到结果拒绝。中心切换不按相同插件ID复用缓存，不把client/token放进PluginContext。

视觉方案：沿现有语义token/字体，两区采用标题+紧凑行列表；左对齐的包名/修订与状态，点击行按需展开详情，版本/审计由独立按钮读取下一页。正常正文显示身份、公开配置、状态原因；代码摘要可换行。沿用现有light/dark tokens，不另造palette；390px单列、可见focus和原生按钮键盘操作。

## TODO

- [x] X03-01 只读模块与精确公共接口；未打开0请求、按需详情/历史及nextCursor分页、读取错误/重试/空态、关闭/换中心取消和拒迟到。
- [x] X03-02 独立真实PG/public client登记配置grants后显示相同revision、重启一致；真实host activate/fail/disable变化；两中心同ID隔离；两主题390px键盘。
- [x] X03-03 固定实现commit与证据、独立review、status/dashboard与架构接收。
- [ ] X03-04 WPF-CHAT01 owner最小挂载真实App入口并另行验收，Execution Lead集成main。

资源：动态端口/唯一临时DB，只清自有资源；0模型/云。先模块fixture交付，不把fixture当App真实入口完成。功能验证不主张性能SLO。

架构目标：新增Web管理视图读取registry与当前host只读快照；真实入口由WPF-CHAT01 owner负责，工程基线图由Execution Lead在接收时同步。现有host trust/权限边界不扩大。
