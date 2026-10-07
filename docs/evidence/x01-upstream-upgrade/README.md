# X01-UPSTREAM-UPGRADE01

同一个 Flow host API 1 Adapter 固定 npm semver 7.8.4 与7.8.5，以 `{version:"1.1.0-a",range:"~1.1",includePrerelease:true}` 实测 **false → true → false**。首A先实际执行，然后生产prepare新材料B，最后新invocation回用A材料；旧binding、两个已安装receipt与内容身份不变。

这是本地真实材料/ESM import/tool invoke，authorize/assertOwnership由测试注入，不是中心切换、真实runner进程、provider或工具函数执行中升级。不同真实上游git/SRI、完整官方53文件各100778/101065B固定于experiment。原始下载只四请求、不重试；每个metadata≤64KiB、tar≤256KiB/10s，先验证官方与派工SRI，再拒绝逃逸/重复路径/链接/设备/条目及展开大小超界。每份ISC原件保留。

Module职责：唯一adapter只做≤4096UTF8 JSON、version/range≤256UTF8与boolean验证并返回规范 `true`/`false`；semver规则来自两份官方源码。构建仅esbuild0.28.2，静态闭包每个输入SHA固定、无externalRuntimeImports。材料提取/信任/固定pin/每phase授权/取消/输出检查复用生产package-store与host，不新建API/第二resolver。

实际2小bundle一个child成功，focusedtypes0；首suite因大写LICENSE被生产规则拒绝：3收集、0通过、3跳过。仅包内名改license.txt、ISC与bundle字节不变；定向同文件3/3。四监督child共1682ms/raw2851B，各final absent/MERGED EOF/完整字节、无signals/secondary，同inode ownTMP删除；历史初始EPERM保留。两轮测试各2个tar close0记录，当前scope0holder/待launch。计时不是wholetool或性能指标。

输出原件与local-summary.json固定。`run-local.py`沿用已审OPS14公共接口与bounded identity cleanup，floor6.3GB覆盖当轮经理6,190,268,416B及有效声明；共享旧KEEP不归本片清理。TMP峰值未知，不声称16MiB硬隔离。

独立review待固定源码后给chatui；主线未接收，真实中心上游切换为独立后继，不把本地证据勾成完整X01-04。
