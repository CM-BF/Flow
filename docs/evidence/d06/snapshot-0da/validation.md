# 本轮验证边界

源码目标 `5124e6cea1edd3437f765ff67aa13386ae845bfa`，策展固定 main `0da869f7bad98771177472539b5a192365c15117`，分支base `6d05ec467581e85d21d5532fd29a2bebd1411b41`。数据与直接测试已冻结。

- [静态来源核对](source-proof.json)：116个固定Git源、157条可识别的字面来源regex核对，错误0；83节点，34处节点文本/来源字段更新，ID/坐标/kind及非node骨架不变。这是Python读取/文本核对，不是JavaScript语法或测试执行。
- 原182个D06证据文件保真。旧aeb 18个Node用例与旧五图页面结果仅覆盖旧target。初审时新22个direct全部NOT_RUN；本次[真实结果](direct-first-20261007/result.json)已22/22 PASS、actualexit0，旧aeb结果不复用。
- 本次实际直接入口为 `apps/execution-dashboard/test/architecture.test.mjs`。顶层server→aggregate→ledger会解析pg依赖，其中一个用例开随机loopback静态HTTP；不是无第三方/无HTTP纯检查。实际准入必须绑定本树入口和只读依赖，不能借旧free/gate。
- 新数据的SVG单行文字布局尚未实测。原225×80卡片、renderer/CSS/server未改；不由几何未变推定新文案无溢出。必要新页面验证沿原五图、键盘、390及双主题接口准备，独立审查/准入后才执行。
- `snapshot-aeb/source-audit.mjs`、`browser-check.mjs`、`preview.mjs`均原样保留历史：其中旧baseline、正负挂载regex、checker/history旧断言和输出目录不能用于新target。后继如需执行，须在新own证据目录重绑；本批不增加运行包装、不覆盖旧raw。

源码提交阶段无Node产品import/测试；后继本次按唯一原入口实际运行22项，3.127s，fresh资源核一次，临时8MiB+raw1MiB预算。未执行页面/PG/Chrome/provider或个人服务；自有进程组与scratch清理。source-only审批不自动升级为本次结果/main接收。

## 后继浏览器静态准备

[候选入口及固定输入](browser-preparation-20261007/index.json)复用原五图/静态fixture与ACCESS已实证清理套路。五图×两viewport×两theme共20个SVG观察和20张计划截图；含node与edge实际getBBox背景及canvas界限，390允许图内滚动而页面无横溢。源5124不改，实际22不重跑。90s含15s清理/256MiB TMP/8MiB raw仅新固定target提案，不继承旧aeb或其他任务许可。当前无gate/native boundary接受/预约；新caller源码待审、真实渲染全部NOT_RUN。

## 首次页面实测

[原件与逐hash索引](browser-first-20261007/index.json)：runtime/modules两组均完成1280/390与双主题；data/light1280的“回复引用”“本地只读”文字超edge背景（canvas仍内），停止后续并保留8PNG。actualexit1，晚父6674.343333ms、外层6732.224458ms，保守spent6733/余83267；两值原件不改。worker/Chrome、HTTP/context、scratch及EOF收尾完整；没有自动重跑、真实聚合/PG/provider/个人服务访问。独立结果审查和归因待办，不能把前两图通过外推五图。

## a28e 第二次页面实证

[固定实际原件](browser-second-actual-20261007/index.json)：5组/20观察/20PNG、实际外层exit0，原全部SVG bbox/背景/canvas、固定source下钻、键盘和宽窄屏主题断言通过。自有HTTP/context/Chrome/组/临时目录清理完整，04:19:53.053937Z即归窗。总预算累计15613/余74387ms不构成重跑许可；原22direct未重跑、首轮失败原件不改。独立结果审与main/真实4320部署仍分别记录。

[root实际独审](browser-second-actual-20261007/root-actual-review.json)已核20观察/200条edge均fit、无页面overflow，并目视覆盖五图/双theme宽度的六张图，0blocking；主线组合target与部署仍独立。
