# SVC08 Web-only 固定宿主选择交付

Source `bad019d9691499bed69ae46b6c5d23944709cfe3`；前片52d3/main2f18保持独立批准。新增实际四产品：preview.mjs、preview.test.mjs、backend-release/host.mjs、README.md；CLI本体未变，原严格请求转交允许可选webHostArtifact。

五个新检查、四个旧直接consumer，共9不同，分轮8/8→3/3→3/3（最后仅强化现有两例的full-start guard）。监督累计2282ms，raw6422B；三组absent/双EOF、14fixture与3scratch正常清理。0PG/Chrome/provider/真实服务/产物构建/安装。原52d3十不同以及原红保持，不重跑旧全集。

接口与状态责任见interface.md。复用backendRuntime的完整artifact验证和sourceRepository真实性，不扩大中心/runner/maintenance权限；pendingWebHost独立于state.backendArtifact且先于信号持久。同journal限制旧入口与新operation，unknown不换ID、不另启。

测试中的eight-file host目录只是注入runtime的源码stand-in，无artifact manifest和安装依赖，不能冒称生产产物。本片证明选择/角色/持久顺序/错误组合；真实完整产物、Node/runtime依赖、内部Web子进程/nonce及个人运行未验。e5来源是backend-release WT，与个人Flow配置不匹配；必须从合法固定Flow来源另建真实host artifact，不能改manifest绕过。个人部署和根因/长期稳定性仍未完成。
