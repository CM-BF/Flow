# Quick b1 首次浏览器实际结果与最窄静态核对

执行产品 fe6ece131c489c79cf531a184e4cf51209f9c4a0 / 实际 metadata HEAD 545769dd23a02e1fcc75e3a6fac0707a909e2807。04:26:26.011693Z–04:26:38.337230Z 唯一运行；外层 actual exit 1、完整唯一 FAILED terminal seal 与 binding/result/budget 三 hash 相符。父 stderr 空、stdout 649B，双 EOF、0 drop。工具 capture 的成功退出不替代被监督进程实际失败。

## 实際失败与界限

固定 apps/web/test/message-settings.browser.ts:89–94 在模型原生 select 聚焦后按 ArrowDown、Enter，再断言值。实际 worker 在第93行得到空值而非长 model，5000ms timeout。checks=[]、pageErrors=[]；第一组未完成，六组不计任何通过；未生成两张390PNG或 runtime-evidence-manifest，原样保留缺失。父结果的 “Browser report: ” 空摘要和缺PNG诊断不替代 worker.failure 完整堆栈。

Picker:240–246 的 filter 先核 opening active/identity，再改私有 filters；:298–299 是受控 native select/onChange，无自定义键处理。fixture:76–96 的 catalog.refresh 不更换 liveContext/ownership；opening/authority问题仍需实际证据。现 raw 未保留 selectedIndex、键盘/input/change事件或失败时DOM，不能从 value 空值唯一归因 Chromium，也不能宣称已证产品 bug。没有 selectOption、first/nth、关闭modal或删断言绕过。后继若获派，仅针对真实native键盘事件/受控值事实验证正确序列；本次未改源码、未运行实验。

## 资源与清理

worker PID/PGID31548、Chrome27442，parent27230；worker fixtureClosed/contextClosed=true。Chrome实际 exit0/signull、stdout/stderr/worker 全EOF无drop。父 cleanup 的两个group及scratch均 absent/errors[]，外层另核parentgroup absent。仅自有隔离HTTP/Chrome；0PG/provider/个人服务。未追加端口或进程采样。

记账采用 root 要求的 ceil(max(outer12325.373167055659, late terminal12284, parent budget12282)) = **12326ms**，browser累计12326 / 总60000 / 剩47674（下一次仍须预留15000cleanup且没有运行授权）。较早12282/47718及terminal12284均为原件，不倒改。原 strict/direct累计5119/剩24881独立保留。

本次失败不撤销先前同fe6 strict+26direct实际限定接受，也不把其覆盖为浏览器通过；完整feature仍未验，主线/生产宿主尚未接收。
