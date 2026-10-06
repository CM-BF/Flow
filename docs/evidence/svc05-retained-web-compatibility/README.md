# SVC05R01 固定准备

两份保留网页对 af51 后台的真实兼容旅程源码已独审；**首次运行在页面启动前因依赖缺件失败，补链后装配已通过，仍没有兼容通过报告**。目标是补齐发布必需的旧页面读取、发送、原 key 显式恢复和能力协商。此次不复跑 d629 的 A/B，不接触个人安装。

- 源码目标：`25b70880619037ddd2ad84ba2790ad23267dc5f9`；四源/sourceDigest：[prepared.json](prepared.json)。运行时再次核四源、外部 af51 全部 487 固定文件与两个产物。
- 来源：`ec5da343880879154e2392f52eaa915d5b08aa77` 上四原脚本与 dc8 逐字同。使用已审 `ef458ff06cf7f12549b4bf3e10fc9b3e4c886ec7` 的 ACK 后头部截断方法；不在请求未受理时伪造丢 ACK。
- 静态文件核验：487 后台文件/25 SQL，23 SQL 调用点的固定文件均存在；两 manifest 与20资产字节/哈希一致。见 [entry-readiness.json](entry-readiness.json)、[backend-static-binding.json](backend-static-binding.json)。这是路径/字节证据，不证明模块导入或运行成功。
- 两条现有第三方 link 已获 Lead 授权并建立；只 resolve，未 import/install。见 [dependency-view-receipt.json](dependency-view-receipt.json)、[dependency-resolution.json](dependency-resolution.json)。后台自己的 workspace aliases/既有依赖视图保持不变。
- 四源分工、局部边界：[interface.md](interface.md)。实际 App 从不可变产物读取，使用 af51 `releaseAsset`；代理只观察公共 HTTP。无 Vite 构建、合成页面或新部署权威。

一次候选运行包含两 App 依次、一个 marked DB、一个真实 af51 工厂及确定性公共 runner、一个独立 Chrome。DOM 收到 unknown 后保留独立草稿，只点击一次 Retry same message；严格核2次 turn POST 的原 key/body/turn/task、真实浏览器同 Request 的 headers→failed、中心一个 turn。legacy 表示只移除 stream header，额外的 profile/401 公开请求是旁证。资产加载 SHA 与原 descriptor 一致。

工作90s+清理20s是已审运行边界；首次 gate 已消耗，后续运行需要新许可。fresh1GiB+128MiB，观察 free/raw/tmp（8MiB/64MiB），保留1GiB+64MiB停止线；这不是 OS 硬配额，PG/WAL另计。Supervisor 只记录并停止它自己 detached 的 worker/Chrome groups，leader退出也核全组；固定动态端口另核监听消失。最后输出及 Chrome 退出后补末样本，再写完整 durable checkpoint。只有 worker报告已收、组/端口不明项为零、marker/目录devino一致、有限连接观察在deadline内为零才普通 DROP/rm。晚回零、查询错误、checkpoint失败或其他未知均保留，不自动重跑。绝不清两只读产物输入。

通过真实断言与清理后才生成每 artifact 四项报告；在自己的700权限 evidence子目录调用原 `importWebCompatibility/verifyWebCompatibility` 校验格式/tuple。不会导入个人报告目录或改变指针。最终 outcome 记录验证成败。

已做静态读/绑定与 whitespace 检查，未做 syntax/types/模块 import/HTTP/PG/Chrome/provider。源报告格式化曾在已写 backend binding 后对数组误用 `.keys()` 退出；原因和原样事实记 [entry-readiness.json](entry-readiness.json)，与产品运行无关。旧 SVC05、旧362报告及 d629 已审事实均不改写。

原静态检查：2026-10-06 18:55 UTC；[quality.json](quality.json)。随后准备已独审、首运行失败已封存；最新依赖差量见下节。

## 19:06 UTC 唯一运行失败与窗口归还

原许可 `svc05r01-retained-af51-20261006-1859` 已消耗；一次 exit1/2.927s，0 App。真实 af51 工厂及公开 runner/profile注册后，导入 runtime 时缺 `@flow/client`，Chrome尚未启动。不是Web早退的共同原因，不重试/改源。原 `runnerStopped=true` 只是未启动runtime的close路径值，不虚称真实runner已运行。

[原manifest](first-run-manifest.json)、[分析](first-run-analysis.json)：worker20247全组absent、63896监听absent；完整checkpoint后marker/devino相同、5.54ms连接观察零、普通DROP remaining[]、自有tmp删除。全程0provider/个人操作，源码25b不变。兼容报告未生成，03/04仍open。

最窄后继：[runtime-dependency-delta/proposal.json](runtime-dependency-delta/proposal.json)。实际三个入口静态递归64文件/164边，bare仅client/contracts/SDK/zod；缺 own af51 `@flow/client` alias及执行profile重导出所需固定SDK。当前只read/resolve/hash，未补链/安装/模块import。须先获依赖delta许可与0PG装配再排新真实窗口，不能把本次失败改绿。

## 2026-10-06 19:10 UTC 依赖差量与纯导入

Lead批准的两条 ignored alias 已建立：`@flow/client`只指同一af51源码，SDK0.3.290指I02已固定第三方包；无安装/正式manifest修改/移动主线源码别名。[link-receipt](runtime-dependency-delta/link-receipt.json)保留精确路径和hash。

一次导入实际 runtime、execution-profiles、verifier 及 server index，四个公开export均为function；不调用它们。Node24/tsx4.23.15、`TSX_DISABLE_CACHE=1`，exit0，1002ms，stdout701B/stderr0、临时新增0B；PGID87258自然退出、全组absent、checkpoint后同devino tmp删除。无PG/HTTP/Chrome/provider。本次只证明模块装配，不替代两App行为，也不覆盖query-time平台资源。[result](runtime-dependency-delta/import-result.json)、[delta manifest](runtime-dependency-delta/manifest.json)。
