# PERF02 固定生产结果与基线比较

2026-10-06 03:47 UTC。实现 target `a87f64f48a3b7e8d03429ab0673c210076a2df0d`；实际测量HEAD为仅增加文档/功能证据的 `e07c34c5f98657b390e8fdc44bb2d85f9360a56d`。六实现文件对target差异0。普通production App、真实公开HTTP fixture、每场1/16/128任务总10000新增+初始40，未减负载、删内容或修改fixture。三场各一次通过。

结果支持把 Activity 的DOM成本限制在视口附近：每场保留10040条；末视口10行，完整历史遍历最多16行。逐条公开DOM读取全部id/cursor/正文，1004窗口/场，SHA与独立生成的expected一致。[机器可读汇总](summary.json)保留min/median/max/count和原始SHA。

| task数 | 末页面DOM：原→新 | ≥50ms Long Task：原count/max(ms)→新 | 96次可信键→rAF中位ms：原→新 | 32次真实wheel→offset/rAF中位ms：原→新 |
| --- | --- | --- | --- | --- |
| 1 | 70,404 → 200 | 8 / 705 → 0 / 无样本 | 11.25 → 1.70 | 33.25 → 31.90 |
| 16 | 71,006 → 802 | 7 / 719 → 0 / 无样本 | 12.75 → 4.80 | 33.10 → 32.40 |
| 128 | 71,281 → 1,077 | 17 / 712 → 0 / 无样本 | 11.65 → 4.05 | 33.60 → 31.80 |

LongTask API三场均支持，0表示本次计时段未观测到≥50ms样本，最大值仍null，不等于0延迟或全部场景无卡顿。阈值过滤EventTiming分别63/83/79条；inputDelay中位均约0.10ms，最大0.5/0.4/1.5ms；duration中位16ms（8ms量化），最大24/16/16ms。wheel不在EventTiming覆盖内，因此单独测；自采key/wheel→rAF不等于物理paint或INP，p95保持null。普通production未启用React profiling，renderCount=null。

| task数 | 10000阶段reveal综合自动化ms：原→新 | attention综合自动化ms：原→新 | 新JSHeapUsedSize 初始→末MiB |
| --- | --- | --- | --- |
| 1 | 2495.09 → 69.45 | 5166.04 → 55.51 | 17.8 → 21.2 |
| 16 | 2550.68 → 59.81 | 5374.16 → 64.61 | 18.6 → 52.1 |
| 128 | 2519.73 → 56.67 | 5383.48 → 76.67 | 24.3 → 31.4 |

这些壁钟含locator点击、React/浏览器调度、DOM等待、CDP及采样往返，不是纯render/paint，也不是稳定因果估计。原5000/10000交付阶段LongTask最大307/705、313/719、318/712ms；新各phase没有≥50ms样本，但projection合并/JSON解析/存储成本并未由此证明有界。

## 出处、环境与可比边界

原PERF01 fixed M02输入 `c526c1c889437ee39155d669921577995195c74e`；其1/16场script `c40f1a02252198f4a4b1a80474743d72b1fa1dca`，128场重试script `3d47cdd4eae959119f154a0d06964cf65006f8c9`，既有采样器失败仍保留在原目录。[原结果](../wpf-perf01/results.md)。本树base `cc33403cd9b357fcd85484b7bc6952dc1220d689`只在M02生产基础上加入已审测量/metadata。本次生产差异仅3个Activity文件，无projection、Attention、App、Thread、host、共享client/contracts、manifest/rootlock变化。

本次源环境[window-environment.json](window-environment.json)，smoke环境另存。M3 Max/16逻辑核、Node24.20.0、Chrome154.0.8037.98 headless、1440×1000、reduced-motion reduce、无CPU/网络throttle；localhost HTTP/1.1实际静态传输未压缩。生产JS 1,109,721 bytes / Node默认gzip 330,358 bytes；仍有两大eager JS组，未宣称首屏lazy优化。assistant-ui JS/CSS和rolldown runtime的bytes/gzip/hash与原基线完全相同，index JS/CSS随本变更更新。

[协调窗口](measurement-window.json)：03:40:14.216Z开始；03:45:25.937Z矩阵结束，03:45:29.848Z清理/退出0已观察。开始loadavg6.20/7.88/8.36，结束4.39/6.25/7.52；原基线在另一并行开发时段(loadavg9.54/8.70/8.01与128重试6.89/7.99/7.87)，不是随机交叉或完全空闲机器实验。已协调后台基准不重叠，但其他agents可有少量PG功能/只读工作，不能把所有timing改善精确归因给本组件。

原producer100条/50ms、4 milestones100/1000/5000/10000、timeout/键盘96次/wheel32次不变。末loaded/lastCursor由公开DOM验证；前期before-reveal仍只是server发到目标cursor后的中间采样，不伪称全部React已应用。新完整性遍历在timing快照之后单独phase，约1004窗口/场；全程HTTP数因此为287 / 302 / 304（含遍历期间继续正常poll），不与原265/280/283不同运行时长直接比较成请求退化；未保存可严格切分的同阶段HTTP计数，该比较UNKNOWN。完整负载在overview，active SSE=0；8chat预算是前置功能校验，不是128并发SSE/模型执行容量。

内存来自CDP JSHeapUsedSize，没有forcedGC或heap snapshot，16task末52.1MiB本身显示GC采样差异。不是retained对象/无泄漏证明，不把其下降当稳定内存收益。projection全量entries/buffer、已测行高map、位置索引仍随加载条数线性；本批只约束DOM，未声称百万历史支持。UA-specific memory API不支持/未隔离，legacy performance.memory仅记录存在且为非标准，未使用其数字。Node public projection驻留[projection-retention.json](projection-retention.json)仍是独立probe：10040保留、reveal后buffer0，不能冒充App heap。

## 行为与原始证据

| task数 | raw | raw SHA256 | 全DOM记录SHA256 |
| --- | --- | --- | --- |
| 1 | [window-1.json](window-1.json) | `730b5d80a86205bc58a21b827d8cf79696d525c32416b8967b71b09445d92f54` | `c57d80e4eb1476cb43027cd5c57ed50af06ee7f2689d2c5facd3648da9f4d8d6` |
| 16 | [window-16.json](window-16.json) | `36e7b228cbb0f51f87065dfe585745c1e7b30e79a2dad8f23647f81205bd16d8` | `31527d6beb853d168f7d46d0b5b4e5329c7ec35f07f419f9dd3bd1f96b6b07cb` |
| 128 | [window-128.json](window-128.json) | `ad8a8477e25aed999e863b745f44db15cd264775a3691f4fd9c2d4dbd8596056` | `17327227fbd2db32d5a397a29b1b027233dd04fe20c03c6279e1b49304e0e204` |

每场全部pageErrors=[]、detail请求1（0→1→cache）、cancel请求0；16/128各保留8chat且可见pane观察预算1→split2→merge1→overview0。attention独立读取/人工决定入口在窗口之外，无为了性能隐藏状态。无真实模型调用。

另[8组变高/键盘浏览器](window-browser.json)验证1040条变高完整性、40次连续Tab跨窗口、焦点行远离视口独立保留、阅读中80条缓冲、index往返、390换行锚点、明确追尾、前插16个历史引用、无预取/取消/error。已实际目视[浅色390](window-light-narrow.png)、[深色390](window-dark-narrow.png)、[生产浅色](window-1-light.png)、[生产深色](window-1-dark.png)。屏读/Safari/Firefox/真实center/I01/CHAT未来组合未验。旧完整性测试错误及一次header依赖修复见[开发失败](development-failures.md)。

辅助fixture-checks与projection-retention文件为本次矩阵同一target最新运行；旧PERF01原始文件一字未改。[quality](quality.md)列技能、clean-code和实际范围。独立review结论以[review](../../../plans/wpf-perf02-activity-window/review.md)为准，报告本身不表示main已集成。
