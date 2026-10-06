# 聊天详情 renderer 接线交付

固定实现 `8014cf9be49391157fb54eeb857a41ee1d6af68c`，base `115b0dbdfa02db5483f9e9699852682ce699633c`。root于2026-10-06T06:40:07Z独立APPROVED该目标，metadata不扩大实现批准范围。主线接收仍pending。

预览 http://127.0.0.1:60956 （真实App + HTTPfixture，无真实模型/产品数据库）。独立新服务，旧49415及其他owner服务保留。启动：在本树根目录运行 `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation-queue.fixture.ts --queue-preview`；端口由系统分配，以命令输出为准。现有fixture文件只读复用。

## 实际检查

- [模块与直接依赖](module-final.log)：8新增adapter + 9既有Appbridge + 14renderer = 31 PASS。没有重跑全库。
- [Web类型](typecheck-final.log)通过；[普通production build](build.log)通过，保留500kB chunk warning，不把build通过当性能验收。
- [开发浏览器](development-browser.json)和[生产浏览器](production-browser.json)：各10组 PASS、pageErrors=[]、退出0。各前9组是真实App；最后1组是独立真实React消费者dev fixture，即使整轮标production也不把该组称production。对应[dev日志](browser-final.log)/[prod日志](browser-production.log)。
- 实际App：初读0detail→Enter1→cache；原生hidden撤局部renderer/恢复展开草稿；两个split当前pane可读；P01停用保留合法fallback且hide/show不重启；overview/close无隐式取消；同revision正文与23turn历史分页；队列Enter/button、Send now等待项门禁、运行完成后普通followup与新草稿；旧连接迟到HTTP不能填新同ID会话；双主题390键盘/reduced-motion。
- 独立React消费者：同runtime/provider无poll，visible=true换viewId；StrictMode + React.Activity hide/show保持展开/草稿/cache。这一组不代替App原生hidden证明。
- 每轮detail共A4/B1：两个App pane、旧中心迟到请求、独立消费者各1；新中心1。注册/恢复/cache本身无额外detail。

[浅色](development-light.png) · [深色390](development-dark-390.png) · [生产浅色](production-light.png) · [生产深色390](production-dark-390.png)。截图均绑定上述固定target，源码与报告hash见[source binding](source-binding.json)。390验证键盘与外层无水平溢出；内部长内容仍依官方viewport滚动，不能据此宣称整个App布局/a11y已全面验收。

## 失败与修复来源

[binding红测](binding-red.log)复现root预审的ready布尔身份错误：同visible换bindings后按钮消失；[绿测](binding-green.log)证明对象门禁修复及Activity恢复。原[browser首轮](browser-first.log)的Merge按钮名称错误、[第二轮](browser-second.log)忽略waiting队列Send now门禁均为测试假设错误，未放宽生产规则。后续固定最终两报告覆盖修正后的真实流程；早期[第三轮](browser-third.log)通过但窄屏侧栏遮挡截图已由最终关闭侧栏重拍，不当最终视觉证据。

## 限制与后继

本片没有真实center/model调用、Safari/Firefox或screen reader检查；未声称全量queue/profile功能再验。稳定converter只消除无消息变化render的函数身份缓存失效，不改变projection数组策略、不提供用户延迟结论。隐藏只终止display lease/注册；原ConversationProjection合法HTTP可继续填同连接同identity cache，不宣称网络被abort。换中心dispose原projection，旧port与结果不能借新connection复活。

App原有关闭conversation保留缓存策略未改；每次挂载的新bridge独立授权。P01仍唯一启停权威，display active不是新read grant。活动MessageFooter、typed工具/推理内容与X01安装权限不属本片。

[接口与生命周期](interface.md) · [质量记录](quality.md) · [状态](../../../plans/wpf-renderer-i01-integration/status.md) · [review](../../../plans/wpf-renderer-i01-integration/review.md)

[管理部署过渡采样](dashboard-transition-observation.json)来自管理者06:36:34.965Z原始77源响应。它证明唯一source与claim登记，当时状态仍启动阶段；不能证明后续固定检查或review已被live聚合。

[独立预览错误/恢复](preview-recovery.md)：原57108长驻dev入口曾报_jsxDEV错误；保留来源并清理本树生成cache后重启，未改产品源码。新URL的root复核与原专用报告分列。

## 独立批准

Root独立31/31局部测试通过并逐读七path；报告/target/current源码hash一致。60956真实App CUA覆盖Enter展开、草稿、native隐藏恢复、停用fallback、分屏/暗主题，页面无新增error；已目视production双主题图。root未重复整套browser/typecheck/build，以作者原始记录为对应来源。详细边界见[固定review](../../../plans/wpf-renderer-i01-integration/review.md)。
