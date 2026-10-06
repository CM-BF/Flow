# Recovery browser 后续准备核对（只读 / NOT_RUN）

固定实现7cc7629b6603a6ccc7e2ab6143125dea8daae685、metadata3896ca58a5c096e97f2816cc2066a537dcf0439e；唯一owner仍workspace_panels_owner。本人逐字核19源 fixed=metadata=current=原manifest，当前HEAD3896/clean。没有改项目、建立candidate、take、import、执行检查、启动服务/Chrome/PG或采空间。Settings1cd/b41c及b2保持冻结。来源hash详audit.json；本报告不授运行。

## 实际启动身份与 Settings 的差异

`conversation-recovery.browser.ts:129–147`：parent先在gate.scratchParent=/private/tmp下mkdtemp(flow-recovery-browser-)，Chrome profile为该scratch/chrome。childEnv复制parent并显式设置TMPDIR/TMP/TEMP、XDG_CACHE_HOME与禁用TSX/Node编译cache，删除隔离admin变量；worker和Chrome都使用它。MAC_CHROMIUM_TMPDIR既未显式覆盖也未删除。没有保存完整继承env，不可从源码声称该变量在首轮环境中缺省。

`:134–147`直接spawn Node worker与安装Chrome，各自detached进程组，父own登记；没有sandbox-exec或自定义文件/网络sandboxprofile，初次manifest命令也是直接Node+显式envfile入口。不能把Settings限定写sandbox的ProcessSingleton失败外推为Recovery必败，亦不能宣称Recovery启动被OS写沙盒限制到scratch。Chromium本身默认sandbox未通过参数禁用，这是不同层。

首轮真实Chrome已达CDP并通过cookieRead，之后在textIntentDraft因IDB缺store/pageerror与5秒predicate timeout失败。原supervisor明确worker25550、Chrome25768 exitCode0/signalnull，是子进程清理后退出事实，不是成功旅程。原scratch=/private/tmp/flow-recovery-browser-D4e8uJ。这证实当次启动成功；不证明Chrome native临时/Crashpad所有写入均在被计量scratch，首轮没有native temp/socket实际path或白名单argv/env记录。

Root已提供的current Chromium mac GetTempDir优先MAC_CHROMIUM_TMPDIR否则NSTemporaryDirectory结论可作后续source依据；本段未重复网页或读取个人Library。Recovery同样调用installed macOS Chrome，故存在该原生临时路径依赖，但本次没有可证明的同类失败。

## 原预算如何 carry

`:13–15`总90,000ms，15,000ms清理；start至少1GiB+128MiB、stop1GiB+64MiB；证据8MiB。`:47–74`fresh gate绑定实际metadataHEAD/19hash、独立scratch<=64MiB；读取每个browser-runs/<run>/budget.json，必须complete与cleanupComplete真并加elapsedMs，再读取旧*-browser-budget.json兼容计数；prior+gate.totalMs不得超90,000。不是只接受人工previous0。

原10raw17415B逐字核同，budget.elapsedMs=14846.267375、complete/cleanupComplete=true；因此下一gate.totalMs最多75153.732625，至少15,000清理，工作时隙最多60153.732625（若签整数毫秒应向下取，不重置为90s）。类型/direct累计是不同账，受控38通过不能消耗或补出browser绿。原首轮失败和清理原件不可移出runs/删除以减预算；未签新gate。

`:98–105/122`每250ms观察shared free、整个evidence目录字节及scratch递归逻辑字节，错误停止。`:21–31`不跟随scratch symlink，统计lstat.size，**不是allocated/物理硬上限**。`:164–197`TERM/KILL仅自己worker/Chrome组，DB按marker/零连接自清、scratch仅进程已确认退出后删；旧complete=false或cleanup未确认禁止后续。首轮DBremaining[]/connections0/removedtrue、cleanupErrors[]/scratchRemovedtrue，仅引用旧raw，无现在DB查询。

两个后续准备时应准确标注的源码边界：`:180`最终删除前记录peakScratchBytes但未重验<=cap，monitor在`:165`已停且没有清理后free采样；`:76`计时在源/gate与历史预算预检之后启动，hard timer在`:94`以完整gate.totalMs安装。不能把“90s”说成含所有调用前预检的物理硬截止，也不能把64MiB或sharedfree样本说成硬配额。这是只读观察，不新增复现/不自行扩大修复。

## 给原owner的最小准备清单（复用原两harness）

1. 若要使本次native temp确实归owned scratch，只需原childEnv显式MAC_CHROMIUM_TMPDIR=scratch并记录白名单temp/实际argv；不改HOME、不读凭据。确认路径够短，保留默认Chrome sandbox；Recovery原本没有Settings外层sandbox，**不要照搬第二candidate或为此扩成通用supervisor**。若之后另获外层sandbox需求，必须独立核owned UNIX前缀权限，不能默认允许系统tmp/个人Library。已有processIds exitCode/signalCode可复用，无须复制Settings整套退出collector；可在原owner记录补launch/close观察语义。
2. 后续gate重新绑定当时clean metadata HEAD及7cc19hash（若harness改则新target），保原10raw与14846.267375累计。现实际App fixture `fixture.ts:357`载本树vite.config.ts、native loader、显式cacheDirectory并服务真实App；它不是Settings独立TSX fixture，不应机械套用Settings单入口optimizeDeps配置或裁掉真实App依赖。依赖继续当前已授权只读固定source，不装/链接/复制moving包。
3. 沿现parent/DBlease/唯一Chrome复核末尾采样和完整cleanup，不改变三中心语义的未验标志。真实同中心cookie子集即使后续绿，也不覆盖caller-Origin、延迟cookie清除、重复connect slot三项中心语义；SSE这里只握手，delivery/reconnect仍PENDING；CREATE两阶段/Queue/Steer、完整knowledge/profile/steering稿及secondCenter仍开放。保留首轮textIntentDraft失败，不借新38受控checks覆盖真实IDB/App。

复用本地find-skills、webapp-testing和clean-code：固定源/真实消费者、分清ownership与沙盒authority、预算不重置、原错误和未捕获事实保留。仅产生这份小报告及audit，后续实施归panels，运行另需shared窗口与fresh gate。
