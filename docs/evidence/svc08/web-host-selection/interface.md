# SVC08 Web 专用固定宿主选择

承接52d3同锁模块，既有输入不重写。fresh claim v3于2026-10-07T03:57:24.093Z增加host.mjs，四原产品范围保持。

受管replace-host可显式提供严格webHostArtifact四元descriptor，格式复用flow.backend-artifact.v1；省略保持旧选择。inspectPreviewWebHostSource可读相同显式候选。验证复用backendRuntime/verifyBackendArtifact，sourceRepository必须仍等于安装config.repository，不能修改manifest或放宽匹配。

同journal下pendingWebHost保存operationId/artifact/source，先于停止/启动持久；新角色授权仅internal-service web，中心/runner/maintenance不接受这个descriptor。成功转为state.webHost并清pending，state.backendArtifact和后台身份/指针保持。unknown保pending并禁止旧Web变更入口重启；同operation只观察。无第二发布状态机/产物格式。

部署缺口：e5产物sourceRepository是backend-release WT，不能用于个人config.repository=Flow；仅真实宿主smoke输入。合法个人Web宿主产物须从固定Flow来源构建并保真实性，本片不构建/安装/部署。八文件摘要不替代完整产物验证或固定动态依赖边界。

验证一个本队普通local段≤90s/8MiB，0PG/Chrome/provider/真实服务；借用原OPS14与已装依赖。注入runtime端口只证明角色选择、pending与失败组合，不能替代真实artifact内容/Node身份验证。实际产物/个人操作后继开放。
