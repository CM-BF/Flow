# 紧凑聊天执行配置摘要

固定实现 `55b244b22a147f3360b12281bac152666749364b`，base `698ffcd94ae073b23bcc67f6665fb19f707a93e4`；branch `codex/web-execution-profile-summary`。

创建后的摘要常显请求模型、锁定或等待回执、访问/思考摘要，以及actual仍未知提示；原生Execution details默认闭合，展开查看完整profile/runner/digest与原请求字段。legacy显式无pin，pending没有改选入口；目录及权限/冻结逻辑不变。没有新状态容器或目录请求。

## 运行与证据

独立模块HTTP预览：[http://127.0.0.1:54239](http://127.0.0.1:54239)。不是整App或真实center。旧预览均未停止。复现：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm install --frozen-lockfile --ignore-scripts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/execution-profiles.browser.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/execution-profiles.browser.ts --serve
```

最后命令使用新动态端口；读其实际输出。Node24.20.0 / pnpm9.15.4；已有依赖，无根manifest/lock变化。本tree的workspace client/contracts，无旧树软链替代。

- [typecheck](typecheck.log)：PASS。
- [浏览器输出](browser.log)、[完整结果](browser-results.json)：原5组受影响旅程+4新组共9PASS，pageErrors=[]，Chrome154.0.8037.98，减少动画。实际Vite fixture编译加载；没有单独production build或全库重测。
- 新旅程覆盖created/pending/legacy、Enter/Space展开收起及焦点保留、完整ref/digest展示、折叠0额外HTTP/选择与草稿不变、long model390。原目录失败分页重试、401保持陈旧页面与禁止选择、unsupported禁用/键盘、Escape回trigger和connection隔离沿用。
- 模块内测得普通created/pending摘要56.15625px，390合法长model128.078125px；不代表整App固定高度，也不与root先前目视约250px做精确性能比率。
- 首次新增long-model fixture误用斜杠，公开identifier校验拒绝第二页；[初次失败](browser-invalid-fixture.log)和[原始结果](browser-invalid-fixture.json)保留。样本改为合法连字符，领域校验未修改；不能把这次采样器错误记作产品失败。
- 固定四实现文件`git diff --check`通过；catalog/selection/App/conversations/shared/rootmanifest/rootlock对base零diff。没有修改其他owner证据。

## 截图

[1280×720浅色已创建](summary-created-light.png)，[1280×720深色已创建](summary-created-dark.png)，[390深色已创建](summary-created-dark-390.png)，[浅色等待回执](summary-pending-light.png)，[390深色等待回执](summary-pending-dark-390.png)，[390长model](summary-long-model-light-390.png)。目录回归图：[浅色](profiles-light.png)、[390深色](profiles-dark-390.png)。图中其余按钮/草稿框为明确模块fixture，不伪装整App。

## 独审与交接

root于05:14:39 UTC限定APPROVED固定55b244，完整源码/依赖边界核查及独立CUA legacy展开/收起/草稿/dark通过；复核作者截图/9browser/typecheck。详见[review](../../../plans/wpf-profileux-execution-summary/review.md)，检查来源不混用。

main集成、真实App组合、真实center/模型、Safari/Firefox/屏读未验证。原region与三个状态文案稳定，可由PROFILEI01 owner/Lead局部验收摘要和草稿，不需机械重跑不受影响的整套。0模型/真实DB。本片claim保留到正式接收，后继变更需固定目标重审。[receipt](take-receipt.json)与[技能/clean-code](quality.md)。
