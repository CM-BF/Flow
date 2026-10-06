# D08 Validation

实现与测试范围为status列明七路径。执行发生在首canonical f772a1e0d89a92f18dfaedd8f2070ce6f3eff4f9 + dirty；[checks](checks.json)与最终[browser report](browser-results.json)逐文件SHA256绑定实际运行内容，不能把之后固定target或metadata HEAD回填为当时执行来源。

- Node24直接检查45/45：[direct.log](direct.log)。新14项含解析缺失/重复/多值、实际status parser、ID/link匹配、自指/循环/两层限制、registered parent缺失/frozen/stale、source冲突、字面转义、真实临时聚合与资料allowlist；既有dashboard/human/proof/delivery-stage31项回归。
- 5组浏览器：[browser-results.json](browser-results.json)，page errors为空、failure null。使用实际临时Git来源/动态HTTP生产dashboard入口；原生键盘Enter/Space、父资料下钻、modal中导航焦点/Escape、更新状态/陈旧/未知/恶意字符串、1280×720与390×844浅深主题/减少动画。没有单独前端build；该Node静态服务即现有运行方式。
- 实際目视最终浅深390截图，文本与焦点可读、raw长路径换行、无横向溢出。截图只覆盖临时样本。
- app.js/task-links.mjs语法检查与实现diffcheck通过；既有锁offline frozen安装通过，根manifest/lock无改。[install.log](install.log)。
- [real-source-observation.json](real-source-observation.json)只读抽查五个当前登记owner源；不是新API部署/全111源观察，不修改source。

保留失败：[first-direct.log](first-direct.log)是作者写错既有404预期，不是产品权限失效；[browser-launch-failure.log](browser-launch-failure.log)是bundled Chromium不存在，改用已有Chrome，无新增安装。[first-browser-results.json](first-browser-results.json)第一次5组通过来源保留，随后runner只改截图为viewport并补launch失败清理；最终截图对应第二次报告，不冒称首报告旧图仍保留。

未验证：新版4320部署、真实源全部关系完整性、真实领取DB读写、模型/产品DB。图/里程碑/父子进度不改。独立review由root执行，本owner自测不能代替批准。

## 独立review期间截图更正（2026-10-06 09:26 UTC）

Root发现原home-narrow-light图y≈758重复页头。本owner实际检查[header-probe.json](header-probe.json)：header DOM数量1，rect=(0,0,390,65)，position=static，viewport390×844/scrollY0；底部elementFromPoint是focus-layout而非页头。该问题不是重复DOM或新关系UI插入页头。

有界复现：同Chrome context从1280×720改390×844、切theme后立即截图，仍可得到[resize原图](header-probe-resize.png)的旧页头像素；等待两次requestAnimationFrame后[settled图](header-probe-resize-settled.png)正确，未改任何产品/测试源码。最终每主题新建390×844 context并等待两帧，得到[真实浅色viewport](verified-narrow-light.png)、[真实深色viewport](verified-narrow-dark.png)，[capture记录](verified-narrow-capture.json)含时间/DOM/尺寸/hash。归因限定为本机Chrome screenshot在resize/theme后的采样呈现尚未稳定，不推成一般浏览器缺陷。原5组行为与无溢出断言仍保留，但原窄屏图不作为已纠正视觉证据；先前“viewport即可纠正”的判断过早，现以这组稳定采样为准。未重跑45直接测试、未改fixed eca产品来源。

全base→交付metadata diffcheck的原始日志例外：first-direct.log第29、31行断言输出空格；保留原log，不称全范围无空白。七实现路径diffcheck为0。
