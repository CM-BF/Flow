# SVC03 固定个人预览页面

状态：in-progress。创建/更新：2026-10-06T08:39:53.644355+00:00。Owner：runner_owner / gpt-6-astra。

将个人预览从可随源码热更新的开发服务改为绑定明确提交与文件散列的静态构建。复用已安装 Vite 的个人 preview 与既有 owned process、operation.lock、maintenance；不创建部署平台。当前服务与用户页面不动，实际部署另经固定已审版本和窗口。

## 范围与 Interface

见 [interface.md](../../docs/evidence/svc03/interface.md)。产物先在私有临时目录构建，验证完整文件清单后原子发布；静态服务只读该产物。后端 source 与 Web artifact 各自记录。只允许原 loopback 端口和同源 /api 代理，凭据仍由原认证流程处理，构建/页面进程不获得 owner、DB、runner 或 provider 凭据。

- [x] SVC03-01：固定接口、范围、领取和验收。
- [x] SVC03-02：有界构建/校验与静态服务，真实临时 HTTP 验证 hash、稳定字节、同源代理和 SSE。
- [x] SVC03-03：接现启动/更新/状态，构建失败保旧、维护失败保暂停，直接消费者验收。
- [x] SVC03-04：固定源码/证据、独立 review、集成交接。
- [ ] SVC03-05：单独批准真实部署窗口与当前用户页面验收（本实现交付不等部署）。

## 不变量与限制

构建须固定 clean HEAD，前后核 source tree/lock；这是可信冻结工作树构建，不声称 hermetic/reproducible build。产物绑定字节，后续源码变化不触 HMR。Vite preview 仅用于本机个人预览；不提供生产互联网部署保证。发布/回退不回退数据库，不自动 resume，不自动 reload 用户页面。停止仍仅匹配 owned PID/开始身份/命令/进程组。

## 验收和技能

0 provider/query，临时私有目录/动态端口，必要一次实际 Web 构建；现有服务端口/数据库/凭据不访问。优先模块公开 Interface 与实际子进程/HTTP，不重复全项目。已按 find-skills 本地优先读取 codebase-design、clean-code、brainstorming、tdd，应用深模块、小 Interface 和行为 red→green；设计已获 GO 批准，无需重复审批。记录见 [quality.md](../../docs/evidence/svc03/quality.md)。

2026-10-06 08:47:45 UTC：固定实现 d9385185a1474c6b058c41b9187c6e075248cb5b，17 distinct局部检查通过，进入独审；真实部署未执行。

2026-10-06 08:50:42 UTC：Execution Lead 独立只读APPROVED d938，当前阶段integration；实际安装方案与瞬时脱敏facts已准备，未部署/未新模型调用。

2026-10-06 08:57:42 UTC：本片段已main并在co-lead授权窗口实际部署固定静态Web，v12 accepting，0query/0tabreload。SVC03-05窗口部分完成，当前用户tab明确未刷新/未验收，作为后继保留，不把服务ready等同用户页面已更新。
