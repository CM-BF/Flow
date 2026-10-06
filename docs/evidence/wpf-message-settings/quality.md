# 方法与 clean-code

2026-10-06 18:11:03 UTC：读取实际本树 AGENTS/plans 规则及本地技能。find-skills 优先已有本地 React/测试技能；未安装或更新。codebase-design 应用一个共享目录生命周期，协议解码各自独立；纯 capture 与受控展示不拥有草稿。clean-code 检查命名、职责、取消/错误路径和兼容范围。React 方法避免镜像 props 状态/渲染请求，snapshot 与 subscribe 稳定。brainstorming 使用既有已批准 bounded 方案；不增加额外规格或审批。技能内容指纹见 [skills.json](skills.json)，后续验证时应用 webapp-testing，当前尚未运行。

公共合同只读，原 configuredSelection 的 Immutable 参数保持；没有 any/cast 放宽新接口。实际代码复核与检查证据待实现安全点补充。

2026-10-06 18:18:36 UTC：完整检查6文件 diff。共享一次目录生命周期、两协议独立解码；公共 capture/allowed matcher 保留权限来源条件。修正 tuple 推导为公共 readonly type，首层工程ID收进details。三旧产品文件仅新增分支/私有泛型提取，legacy创建参数逐字保留；旧CSS/官方组件/App/Queue/Recovery/shared/lock均0diff。git diffcheck0。未运行types/Vitest/fixture/Chrome，不记录红绿。后继父supervisor持有所有fixture/browser清理与预算，当前导出检查函数不暗启服务。

2026-10-06 18:24:17 UTC：P2 窄修固定 f3a6a7ec89d5b3f789c49b0d8662401b23032ab2。只改 Picker section断行和已有文本映射及browser对应断言，没有CSS/共享范围扩展；原spec行为检查体保持。原source manifest封存，当前manifest重绑六源；0types/import/HTTP/test/Chrome/space，source diffcheck0。
