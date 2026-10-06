# 技能与 clean-code

2026-10-06 11:03:55 UTC：沿本地优先find-skills，已读brainstorming（采用现成已获批设计，不重复审批）、assistant-ui、codebase-design、clean-code、webapp-testing，并采用vercel-react-best-practices外部store稳定snapshot原则；固定本地hash见[skills](skills.json)。无安装新skill。assistant-ui官方llms/attachment文档已在前置研究读取，实际接口以已装0.15.23/core0.3.22为准。clean-code本地来源沿sickn33/agentic-awesome-skills固定全局基线。

开工clean-code：Controller负责绑定与状态；recovery负责有限持久元信息；adapter只翻译官方attachment生命周期；Picker只展示与触发。避免复制公共schema/ACK/HTTP、无第二权限/registry。此时仅计划，无产品检查；已核独立tree/branch/base/clean与liveclaim。后继每段/约30min/交付复核错误收敛、generation、cache与真实行为。

2026-10-06 11:17:57 UTC 工作段clean-code：14局部测试通过。首轮发现公共accepted含replayed而receipt严格schema不接受，现只向公共receipt parser传其确切字段，保留accepted整体先parse；首typecheck的readonly content类型已修，真实composer移除改用公开getAttachmentByIndex().remove，send返回void不伪catch Promise。保留首失败日志；最新typecheck通过，但新browser脚本尚待后继验证。确认capture身份与有序prepared IDs、原稿与新稿分离；明确dispose和protected tab关闭不是同义，journal恢复不自动附新稿。根manifest/lock与共享只读；未固定实现target，未独审。

2026-10-06 11:23:35 UTC 交付clean-code：固定4c4de124b24a85b9e2a13e097b29c80b1e84d11a，9source/current/browser hash全同，保护范围零diff。17 tests（405ms）/Web strict types/10 browser组全通过。修复两实际消费者问题：portal表单冒泡误提交；公开composer同步只移除曾拥有的ID，避免误删恢复上传。新增ignored-abort upload/list deadline、原键显式重试、prepared ID顺序和授权代际失效；已知恢复记录提供显式本地forget，unknown仍保留。命名/职责保持controller/recovery/adapter/Picker，未复制DTO/HTTP/权限或另起registry。最后仅元数据和证据绑定，没有新产品改动。

浏览器第二轮错误来自文件按钮大小写，原Promise未及时捕获；现Promise.all等待chooser+click并统一finally。第三轮mock lookup错误携带accepted.replayed，现按真正receipt shape提供typed值。第五轮drop发到outer form而非官方dropzone，现定位其data-slot。保留原失败日志；最终图与hash以browser-results.json为准。运行环境仍共享机器，未作性能声明。独立review/main待交接，真实Send/Queue依然pending。
