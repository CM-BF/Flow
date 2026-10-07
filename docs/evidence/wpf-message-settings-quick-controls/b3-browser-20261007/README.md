# b3 第三次浏览器实际失败

唯一实际运行 2026-10-07 05:20:53.766867–05:21:05.923599 UTC；产品fe6，执行HEAD f9fa995516b8c169edf17fbe1a28e044b6c619b4。actual outer exit **1**，唯一 FAILED terminal，present hashes和absent/null manifest相符。原件：[outer actual](outer/actual-exit.json)、[terminal](outer/stdout.txt)、[worker](raw/browser-results.json)、[trace](raw/select-diagnostics.json)、[索引](archive-manifest.json)。0/6完成组、0/2PNG，pageErrors=[]。未补造缺失证据、未自动第四次。

本次已完整捕获诊断：模型select的focusin、ArrowDown down/up、Enter down/up及各自下一帧，共10记录；isTrusted=true/defaultPrevented=false，持续focused/connected/enabled，3个options存在，value空/selectedIndex0，无input/change；truncated=false/dropped0/observerErrors[]。原断言在browser.ts:93等待长model值失败。事实说明按键送达而本次选择未提交；不能单凭这些字段唯一归为产品、浏览器或平台原因，不修改键序/控件/断言。

本轮无retained超限错误；384个原样本与完整结果保留。b3计量小检查既有5项通过不代替此浏览器结果，样本也不冒物理分配因果。parent/worker/Chrome PID分别44260/48618/44487，记录的三个owned PGID signal0均ABSENT；scratch absent、cleanupErrors[]、worker/Chrome/outer EOF/0drop。worker fixtureClosed=true/contextClosed=true已捕获；此事实不回填b2的NOT_CAPTURED。Chrome实际exit0，worker1。

按实际outer12156.567208ms、late12096、parent12095的最大值向上取整，本次12157ms；累计**30625/60000ms，余29375ms（仍含15000cleanup）**。原parent spent30563不改。strict/direct预算独立保留，不重跑26；旧b1/b2 86prior pins不变，6组/2PNG仍未通过。[保守账](conservative-account.json)。

仅正常归档失败与清理，完整feature仍UNKNOWN；无第四次/新gate/产品改写授权。执行前native准备接受见原b3-accounting原件，不等本次行为批准。

[root实际独审原件](root-failed-actual-review.json)已限定接收本次FAILED、完整trace、保守计时和owned清理事实，非feature PASS。历史Chromium Mac popup机制仅为后继研究线索，未验证本机精确版本，不据此改变产品或测试键序。
