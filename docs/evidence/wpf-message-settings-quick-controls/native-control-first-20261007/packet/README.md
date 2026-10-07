# 原生键盘对照：已准备，未运行

固定新增源码 `bdf444f13f2963235ab3f1659546d19fc8f5c203`。唯一变化为现有 message-settings.browser.ts 增加本地控制页和诊断入口，Picker/React fixture/direct test以及原六组函数逐字不变。此前 fe6 strict/26direct 证据只沿用未变业务边界，新诊断没有类型/浏览器通过结论。源审 **NOT_STARTED**。

普通原生控制 A 用 ArrowDown→Enter；全新文档 B 用 Space→ArrowDown→Enter，每键读取被动快照并有界等待一次 rAF（不是 popup readiness 保证）。仅 B 真实选中目标且出现 trusted input/change，才对真实 HTTP catalog 的 modal B 同序列一次。保留 C/A/B、右pane、正文、commits=0；不调用 Apply。无 selectOption/值赋值/合成事件/重复猜键/sleep。原6组的 full 模式未改、断言未删。

mode=diagnostic 的完整 measurement 终态叫 DIAGNOSTIC_COMPLETE，不是 PASS 或6组通过；控制 B 不成功则 INCONCLUSIVE，worker/parent失败并保存所有实际观察。native-control.json 在异常路径仍写入，原有 select-diagnostics/EOF/双group/fixture/context 清理保留。最终接收仍要 actual outer exit、唯一一致 terminal、原件hash与cleanup，不能只读磁盘状态。

已消费 b1/b2/b3 全部原封。旧60s历史实际30625ms/未用29375ms封闭，未用不转新段。新增actual累计≤90000ms、每次≤45000ms含15000ms cleanup；TOTAL150000仅防御上限，新段独立≤90000。第一入口的gate必须 previousSegmentRuntimeMs=0，后继沿同一结构化record按 ceil(max(actualouter,late,parent))保守追加，不倒改原计时。scratch64MiB/总retained8MiB（含旧全部raw、当前包、outerreserve及segment metadata）不抬限。

专用准备包 `/private/tmp/msgquick-native1`，复用b3监督/observer，只增加模式/新段/完整历史carry。parent/worker精确diff在该包，旧raw不复制，仅134条原件hash和1,466,235B引用；不创建通用runner/第二权威status。`/private/tmp/msgquick-native-segment-20261007.json` 为唯一新段实际测量记录，目前 runs=[]/spent0。无gate、native精确批准 null、state PREPARED。metadata提交后只重绑包HEAD/manifest，最终TMP值供root独审，不为这次绑定递归提交。

准入前须root接受初始source/parent/worker差异，再核fresh组合资源与独立Chrome窗口；当前不占用C02 PG/Recovery Chrome，无PG/provider/个人服务/安装或运行。后续同已审边界修复按明确有界工作段执行，未知cleanup/范围/边界改变停止针对复审。

静态检查看 static-audit.json；未运行Node、types/direct/browser/HTTP/Chrome。clean-code：观察/输入分离、保原验收、小私有入口、不同诊断与功能终态、原错误与证据留存。find-skills复用已装clean-code/codebase-design/webapp-testing/brainstorming（有界方案9160已经明确接受），未安装或新增技能；来源hash见 causal-sources.json。

最终 metadata HEAD `1aa73f6dba8f3536b43624659ea8a02529646c03`，local=remote且clean。原始预算与runtime仍NOT_RUN，PREPARED/native接受null，无gate。

## 限定独审已接收，仍未运行

Root 263ec06a 已批准初始诊断source/parent/worker，不是实际通过。sourceReview已绑定；旧b3 native边界 c41d68ae 作为相同权限模型依据保留。现supervisor仍要求独立ACCEPTED记录的runner/worker完整hash精确相等；旧dad6/f099不能冒覆盖当前c15a/3a52，因此 nativeChromeBoundaryApproval 保留null、PREPARED。需root或manager以已有边界接受签当前精确绑定，而非修改guard/作者自批。

仅等待Mika实际性能归还、当时freshclaim/source/deps/组合资源和single-usegate。唯一命令仍 `python3 /private/tmp/msgquick-native1/supervisor.py --gate <fresh gate>`；首段gate为diagnostic、45000ms含15000cleanup、previousRuntimeMs30625、previousSegmentRuntimeMs0，usage原hash不变。未生成gate、未采空间、未启动Node/Chrome/PG。所有脚本及场景未变。
