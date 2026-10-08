# 质量复核：诊断专用通知

时间：2026-10-08T03:57:08.730Z。模型 gpt-6-astra；范围为本树已领取五源码，固定目标 b7dd3add045bc3b3daa3f2ffdb21cb2cb9b4b01a。

本地技能发现优先复用已安装方法，本段未安装/更新技能或依赖：

- find-skills: `/Users/citrine/.agents/skills/find-skills/SKILL.md`，SHA256 `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f`。

- clean-code: `/Users/citrine/.agents/skills/clean-code/SKILL.md`，SHA256 `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317`。

- brainstorming: `/Users/citrine/.agents/skills/brainstorming/SKILL.md`，SHA256 `74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608`。

- codebase-design: `/Users/citrine/.agents/skills/codebase-design/SKILL.md`，SHA256 `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2`。

实际应用：既定设计已明确，由 brainstorming 方法核责任与边界；codebase-design 保持 PluginHost 内部 record→窄订阅接口，不增第二诊断store；find-skills 复用本地 React/host 领域方法；clean-code检查命名、职责、错误处理、重复与测试可观察性。

`subscribeDiagnostics` 稳定绑定，只负责通知；快照保持冻结与100项上限。错误观察者不递归记录自身错误、不替换原异常；dispose解绑，registry与slot发布路径保持。测试以真实host行为和真实生产Settings消费为准，不仅复制实现。

已修正两项测试/工具前置：声明命令必须实际实现后才能测源订阅；Vite客户端声明采用已安装入口，不放宽类型设置。真实Settings挂载夹具先完成所有真实panel owner激活，避免打开面板的生命周期事件冒诊断发布。

未解决/限制：mounted仍NOT_RUN；测试入口未在本次affected四入口strict中；未来需固定owned Vite/Chrome caller及真实JS/CSS闭包，不能沿legacy默认全跑/I01输出。无新权限/公共schema/全局事件平台。
