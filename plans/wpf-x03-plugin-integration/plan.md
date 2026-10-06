# WPF-X03I01 插件管理实际 App 挂载

2026-10-06 04:28 UTC；in-progress；唯一owner workspace_panels_owner / gpt-6-astra ultra。本计划承接已审[X03模块](../x03-plugin-management-view/plan.md)的真实App入口，不重写模块或扩大完整插件管理范围。

## 方案与边界

固定main基线4e0289f29ffa48c6c49003837d4520f57c22b6b0含CHAT已审实现7cb与X03 metadata1290/实现895。现有Extensions and appearance Dialog增加显式Plugin management折叠，模块按需加载，open=settingsOpen && expanded。App useMemo([client])创建四个保this只读方法wrapper；不把client/token传入PluginContext或host。session.id绑定中心连接；当前无项目选择，默认Personal。中心registry版本/config/grants/audit与本连接trusted runtime明确分开，不按名字匹配或自动安装/激活。

关闭/折叠销毁读取子树并abort，重连换session拒绝旧结果。保留Dialog Close/Escape回入口与旧本地启停/主题controls。设置CSS仅命中原controls，不能污染X03列表。官方Thread/AI Elements面板不修改，聊天草稿保持。仅七literal范围见[status](status.md)及[receipt](../../docs/evidence/wpf-x03/take-receipt.json)。旧CHAT/I01已移出对应三文件，不恢复旧树写入。

## TODO

- [x] **WPF-X03I01-01** 固定输入、独立tree、receipt与唯一canonical，发现本地技能并记录。
- [x] **WPF-X03I01-02** 实际App settings懒挂载，bound reader/session隔离及CSS兼容。
- [x] **WPF-X03I01-03** 独立HTTP fixture通过真实App验证零预取/显式详情/关闭重连迟到隔离/焦点/本地启停分离/双主题390/原Thread草稿，必要生产冒烟。
- [ ] **WPF-X03I01-04** 固定实现commit、独立review、dashboard聚合与MainLead交付；main集成单独记录。

## 验收与风险

真实App HTTP fixture仅模拟public registry/conversation协议，0真实模型/声音/数据库调用；已审X03独立模块12checks按来源复用，不重复数据库套件。新专测与服务用动态端口并只清理自有临时资源；49922/55049/63743/55247保留。依赖仅既有锁frozen安装，不新增依赖/更改lock。每工作段和交付clean-code；metadata检查链接/TODO，不为其跑产品套件。架构仅增加App私有reader→已审X03的懒加载组合，公共协议/host不变；交付向架构owner登记该接缝。
