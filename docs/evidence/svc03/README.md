# SVC03 固定静态预览证据

实现 target `d9385185a1474c6b058c41b9187c6e075248cb5b`，基线 `7106a35447bf43026ad7b5ad7c25dc530fd0c4f5`。唯一 owner runner_owner / gpt-6-astra，2026-10-06 08:47:45 UTC。该分支实现/验证，不等 main 或个人安装已部署；当前用户页面/服务未操作，0 provider/query。

## 已验证

[checks.json](checks.json) 记录 **17 distinct**：7 项 artifact/static HTTP/environment，10 项实际自有空预览启动/维护直接消费者。后者使用随机 `flow_preview_*` DB/动态端口，实际中心+runner 发布配置而不发模型任务；仅提交 Claude runner 不可执行的 fixture 排队事实。每fixture正常 identity-checked stop、DROP自有DB、清临时目录，未扫库/未接管现有安装。10 JS语法检查及diffcheck exit0；没有改 TS，不把 Node syntax 当全库 typecheck。

[product-artifact.json](product-artifact.json) 是在最终 clean target 单独保存的一次真实产品Web构建清单：10 files、1,439,185 bytes、663ms；摘要包含每文件hash与source/tree/lock/toolchain。产物临时目录随后清除；这个独立记录不是新增行为测试。实际 owned 预览用同一构建路径，不以合成HTML代替产品构建。

产物固定SHA与完整文件集；忽略私有.env与继承VITE/provider/application变量；并发同内容构建原子归并，篡改/额外文件/symlink/dirty或变化source拒绝，失败stage清理且保留旧产物。真实HTTP核源码改动后bytes不变、无HMR脚本、原Bearer/Origin转发、SSE首chunk在结束之前到达、占用端口拒绝。启动ready核 owned listener+manifest identity，status另报后端source和Web artifact。维护校验失败保旧PID与持久暂停，原TERM/外来PID/显式resume消费者保留。

## 原始输出与失败

首次 `artifact-red.txt` 为已导出stub公开行为失败。`artifact-green.txt` 为macOS /var→/private/var临时目录canonical输入未对齐；`artifact-green2/3.txt` 是错误假设压缩器引号风格导致断言失败，改用实际执行生成JS观察fixture值；`artifact-green4.txt` 首次1/1通过。`modules.txt`4/4、`module-environment.txt`6/6、`owned-first.txt`2/2都与最终重复，不累加。最终模块7/7+owned10/10；不会把早期输出改写为最终源码实测。

## Interface、限制与部署

见 [interface.md](interface.md)、[工具说明](../../../tools/personal-preview/README.md)、[质量记录](quality.md)。Vite8.3.2 preview仅本机个人预览；不是互联网部署平台、OS隔离或hermetic构建，依赖来自已安装包。构建在可信clean冻结工作树前后核source/lock；不证明恶意瞬时更改或依赖目录未被攻击。artifact逻辑不可覆盖且每次启动/status全量核hash，但同用户可改磁盘权限/字节；不声称内容是OS不可变。构建≤90s，4096files/32MiB每文件/64MiB总量。

本片不启动/reload当前个人服务，不验证新模型/真实对话。静态Web不会追随未来main/HMR；后端仍按原启动源码加载，单独记录sourceAtStart，不声称后端也变成不可变发布。发布/回退须固定已审版本、兼容性与单独窗口；无自动回滚DB/自动resume/自动tab reload。单受管runner维护边界保持，多runner全局停机未新增。

## 独立审查

NOT_STARTED。固定源码/原始证据hash见 [manifest.json](manifest.json)，审查11个source条目（含README）与13份raw；不需要重跑全项目。
