# 固定宿主工具闭包：局部结果

source `2affec4cc7a899082cbf48fce5bbd0f77293676c`；base `59c0fccb41e33076d50c5f782683c9f3fd25061e`。4产品/测试文件。原b218七源局部审查和a2e主线接收保持；本次检查仅已改变的selector和受影响staging。

- 实际首轮启动 `2026-10-07T03:04:57.340402+00:00`，末轮退出 `2026-10-07T03:05:53.817491+00:00`；4命令外层监督累计 656 ms，单命令≤30s、累计≤120s。时间是原结构化记录的实际start/finish，非目录标签。
- 两个新增反例先2 red；随后selector 7/7（5既有用例随新fixture调整、2新增），staging direct 1/1。8 distinct、10次selected执行，不把red重复计成不同用例；原runtime-installation其余5例与empty-cache未复跑。其余selector行为属于本次被修改模块。
- 固定main `a2e7803161ffb7e2158eaf3c13531448d2a777b0` 真实锁额外只读selection退出0（非新增测试/安装）。7 importers、271 snapshots/packages；Vite spec8.3.2、完整peer键来自固定apps/web importer。Web/TUI importer未选，原Web manifest/importer保持。完整cache内容/物理峰值/真实filtered安装/产物Vite resolve或启动仍NOT_RUN。
- 总raw 10059 B；四个owned组均absent、stdout/stderr完整EOF、secondaryFailures空。四tmp根经初始dev/ino核且empty正常删除。20ms采样最大tmp逻辑3209 B/allocated53248 B；最低free 26541588480 B。采样不是原子峰值、reserve或物理可回收证明；没有缺样/错误。fresh≥2.5GiB、live≥1GiB未降低。
- 0安装/fullbuild/PG/Chrome/provider/个人操作。本队local段已实际归还给native SVC08，不再运行。

原件 [run.json](host-tools-validation-20261007/run.json)；[固定source选择](host-tools-validation-20261007/fixed-source/stdout.txt)。其中red source bindings保留修复前字节；不改旧记录。

Clean-code复核：2026-10-07 03:07:14 UTC，单一静态工具来源表与原遍历/投影复用；没有外部任意工具名单、role分支或新host状态规则。固定工具来源缺失/歧义拒绝，根与Web源文件还原仍由原seam负责。未解范围是完整pnpm布局/真实artifact运行，不把纯选择当成功产物。独立review待Lead。
