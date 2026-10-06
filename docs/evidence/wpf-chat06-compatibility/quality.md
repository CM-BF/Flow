# 技能与clean-code

2026-10-06T06:46:52Z，workspace_panels_owner / gpt-6-astra ultra。按find-skills本地优先，复用并实读 `/Users/citrine/.agents/skills/find-skills/SKILL.md`、codebase-design/SKILL.md、assistant-ui/SKILL.md、clean-code/SKILL.md；无安装。clean-code用户指定来源sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，当前文件SHA256 3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317。

方法：保持深模块现有projection Interface，能力读取与请求/正文消费分开；同一校验同时作用GET和CREATE；畸形值使用真实wire入口，不逃过类型。局部有意义矩阵先红后绿，错误与未确认回执语义保留。每工作段/交付核名称、职责、错误、重复和不必要复杂度。

初段发现：原literalfalse同时拒true与missing；CREATE可能已经中心受理但客户端拒回执。GO已定后继CREATE永久false及GET协商，reader仍需保守兼容不同中心输入。本片不修改domain/client或用UA猜版本。全部旧claims收口与本树分开，旧服务保持。

2026-10-06T06:50:26Z 工作段clean-code：保留一处readCapabilities供GET/CREATE调用，返回规范化新对象而不修改wire对象；missing转false但其他能力严格不变。真实FlowClient的mock fetch Response接收畸形wire，不新增as/any类型绕行。初轮77中14failed/63passed命中原true/missing门禁；修复后projection77+queue16+outbox11=104passed、Webtsc通过。frozen/offline安装3.3s，根manifest/lock不改，0新依赖；未加runtime.queue/stream请求/正文渲染/新服务。与D06历史metadata/release分树操作，本树scope未扩。
