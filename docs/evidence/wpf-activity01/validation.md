# ACTIVITY01 验证

实现 `61b9349af390c137cc4cfeabd38bad058ec69cb5` / base `3d4985fca060155435b159e0467815bf8e88b8b8`。Node24.20.0、pnpm9.15.4、Vitest4.0.18、Chrome Playwright；既有依赖frozen install，root/app manifest及lock/shared零diff。

## 已执行

- 22直接行为检查通过，[direct](direct.log)，2026-10-06 06:13:36 UTC，263ms；命令 `pnpm exec vitest run apps/web/test/conversation-activity.test.ts`。身份、lazy0→1、成员校验、缓存、宿主更新不被旧page覆盖、cursor异常/分页/reset、sameID重置detail隔离、hide/offline/dispose、已abort前不发reader、迟到reject被消费、公共1MiB与100页界限。
- Web `pnpm --filter @flow/web typecheck` exit0，[原始日志](typecheck.log)。测试中初期reference联合类型推断两次报错，已显式标注测试page/entry类型修正，无宽化生产DTO。
- 开发与生产各7条HTTP浏览器旅程PASS、errors=[]、failure=null：[dev](browser-results.json)、[prod](production-browser-results.json)。来源/时间保留598e5e2+dirty，逐6源码SHA256与fixedtarget复算一致：[binding](source-binding.json)。不把后来metadata SHA伪称原始测试版本。
- 生产独立fixture实际经Vite8.3.2 build及preview，141modules，JS385.42kB/gzip115.01kB、CSS82.38kB/gzip14.53kB，见[build与旅程](production-browser.log)。这些是含React/UI/公共client与fixture样式的独立bundle，不是App总包性能预算。
- 作者目视浅色desktop与390深色图、最终生产390深色图；正式semantic foreground/muted-foreground/ring可读，无横向溢出。列表25行/滚动区60vh，长正文8192code-unit页（不切开代理对），键盘列表End/Home和正文焦点通过，reduced-motion transition0。
- 实现diffcheck0，产品/共享/旧Thread/App全无旁路修改。无新依赖、SSE或interval。

## 原始失败与修复

第一次调用测试时frozen安装尚在运行，vitest not found；安装完成后再跑，记录[red](red-direct.log)为尚无module的导入失败，不称行为回归失败。初版模块[16行为](first-direct.log)通过。清码/root moving只读观察引入后续6边界测试（已abort/late reject、reset同IDdetail、非法reference与超100页），最终22通过。awaitSignal改factory，已abort不发请求、同步失效后的promise仍消费拒绝；详情单独generation及abort隔离reset。CSS初版误用muted背景token，在browser前改正式前景token；初轮7+7通过后补有界滚动区/正文键盘/视图scope key/局部动作错误显示，并最终重跑7+7，当前报告均最终源。

## 限制与交付

只读通用task timeline，不是typedtool/thinking/partial，也不写assistant正文。展开前events/detail0，展开列表一次、引用二次读取缓存；source只说明已读状态，显示host真实TaskSummary且验证独立。events公共client没有signal：隐藏停止新读并丢弃旧响应，不能称底层HTTP取消；conversationDetail使用真实signal，URL按host绑定conversation/turn。详情限制公共1MiB，不改成CHAT05 64KiB；分页仅视图处理。

没有真实center/DB/model、没有App/Thread接入验收；不改变旧预览。独立review [已APPROVED](../../../plans/wpf-activity01/review.md)，main未集成。root06:17:33独立22 direct与CUA限定旅程通过，未重跑作者7+7/typecheck/build。App接入需后继唯一Thread owner的always-visible message footer与单一折叠入口；现hideWhenRunning ActionBar不适用。

完整base→metadata diffcheck exit2仅原始direct/first-direct/typecheck末尾空行与red工具引用源码的行尾空格/末尾空行；保留raw，不清洗。固定实现与排除raw日志的source/docs diffcheck0。
