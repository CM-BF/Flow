# 知识上下文选择独立模块

当前实现 `736ef0b9f5647faa4c8d8e6c4755eaf95697b02d`；原完整UI检查目标 `34cd2b840b06b22f1c7087e5e1e84ef14eb335f8`，基线 `b54de1dbb08e3ccc7d33a27295a318f2799e76ae`，branch `codex/web-knowledge-selection`。公开[Interface](interface.md)、[质量](quality.md)、[七文件hash](source-manifest.json)、[计划状态](../../../plans/wpf-context01-knowledge-selection/status.md)。

搜索只读短预览；明确勾选whole citation，展开才读取完整chunk。最多4引用/8192 locator bytes，最近20搜索结果，正文LRU8项/32768B，同一生命周期拥有1search+2resolve且无隐式排队。网络abort尽力取消传输；忽略signal的旧port结果仍经代际丢弃，不能保证远端立刻停止工作。host显式setReadiness更新可见/在线/授权/能力；关闭picker不阻止已授权引用的本地freeze。缓存只说明上次读取观察，显式refresh不改变引用版本。

从本工作树启动：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web exec tsx test/conversation-context.browser.ts --serve
```

当前独立HTTP fixture预览 http://127.0.0.1:60172 ，session10538保留。运行无模型、真实DB或真实项目数据；synthetic bearer是公开fixture-only。实际FlowClient由本树workspace client/contracts提供；未借旧树包。

验证：

- 最终16模块tests PASS，2026-10-06 07:51:22Z开始，15ms tests /588ms总：[原日志](module-tests.log)。前轮16也通过，[首次日志](module-first.log)保留。
- Web `tsc --noEmit`通过：[最终typecheck](typecheck.log)，既有依赖frozen-lockfile/ignore-scripts安装，根manifest/lock零改。
- 9组浏览器PASS，Chrome版本/HTTP请求/时点/[原始报告](browser-results.json)；同树真实FlowClient HTTP接口，StrictMode注册，初始0HTTP、选中0resolve、首次展开1/cache0、native hidden→freeze→resume0读、旧版本保留、markup转义、unsupported保留选择、offline晚响应与project隔离。
- 最后微小整理限定嵌套details事件及disposed freeze，16tests/typecheck/9browser已重新通过。首次[日志](browser-first.log)与[最终日志](browser-final.log)保留；browser-results为最终运行，截图同次生成。报告在实现commit前生成，七source hashes与固定target/current全相同，见manifest。
- 作者目视[浅色](knowledge-light.png)、[深色390](knowledge-dark-390.png)、[浅色390](knowledge-light-390.png)，真实键盘Space/Enter/焦点、reduced-motion与无横向溢出断言通过。
- 七源码固定diffcheck通过。完整base→metadata diffcheck另有5个原始日志末尾空行提示（module-first.log:10、module-tests.log:10、typecheck-first.log:4、typecheck-fixture.log:4、typecheck.log:4），原日志保留不清洗。未全库测试/未实际App生产build；本模块尚不在App入口，fixture由Vite真实编译且Web整体类型检查通过。未测屏读、Safari/Firefox、实际产品中心/模型。

本片没有发送/排队/ACK集成，薄context reader/会话组件保持只读。中心最终执行输入预算仍可能拒绝；未来消费者必须保留原稿/refs，深冻结原request并核ACK context.sources完整tuple和顺序。不能从这里的本地freeze测试声称真实Send/Queue已经携带知识。P01宿主/授权、Dialog与App接线另领取，不造第二registry。main尚未接入本片，root独立review于07:56:55Z APPROVED固定736ef，R1关闭；详见[review](../../../plans/wpf-context01-knowledge-selection/review.md)。

R1独立审查发现显式signal覆盖client默认timeout，已在736ef修正本地15秒deadline（adapter忽略abort仍结算），原目标REQUEST_CHANGES。18模块fake-time受影响验证与typecheck通过，未真等15秒；新[来源hash](r1-source-manifest.json)/[日志](r1-tests-first.log)/[类型](r1-typecheck.log)。原9browser/screenshots/原manifest保留34cd，不重绑新hash。736源码diffcheck0；新增原始r1日志同样保留末尾空行。

独立review检查来源：root独立18tests（07:55:49Z，15ms/225ms），七hash与e216clean/source diff核对，CUA60172搜索/选择/Enter、隐藏freeze/恢复草稿与Dark转义、console warn/error=[]。root未重跑原9完整browser/作者tsc或真实App。源码保持固定736，后续仅metadata，main仍待接收。
