# 附件输入与预览独立模块

本片使用已安装 assistant-ui 0.15.23/core 0.3.22 的官方 Thread、AttachmentAdapter、AttachmentDropzone、公开 composer API，以及8701固定附件 DTO。五个产品文件分工为绑定控制、有限恢复日志、官方adapter、Picker和主题样式。没有改生产App、公共client/decoder、共享合同或根依赖。

## 使用与验证

在本worktree执行（Node24）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web exec tsx test/attachment-input.browser.ts --serve
```

终端输出独立动态URL。普通模式运行10组浏览器检查并关闭自己的浏览器/服务；`--serve`用于审查，服务保持运行。fixture提供真实官方Thread及typed内存ports，不手写HTTP、不伪造尚未发布的client方法。

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web exec vitest run test/attachment-controller.test.ts test/attachment-recovery.test.ts
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm --filter @flow/web exec tsx test/attachment-input.browser.ts
```

局部结果见[17 tests](module-tests.log)、[Web types](typecheck.log)、[浏览器原始结果及源码hash](browser-results.json)。[浅色](attachment-light.png)、[390深色](attachment-dark-390.png)、[390浅色](attachment-light-390.png)。所有检查均无真实provider/产品DB；截图只代表独立模块，不能当生产App已接通。

## 行为与限制

- 文件按钮/拖入复用官方adapter；@file是显式命令，只列绑定project上传的文件。正文仅显式展开，完整文本校验UTF8长度和原文digest，不把全文插进message.content。
- pending、unknown、过期或不支持的文件不进入capture。点击同步捕获intent/text/顺序refs；官方异步准备之后验证同一capture，只有本地收据接管才consume原选择代际，网络ACK不清稿。fixture的本地capture不等于真正Send/Queue受理。
- readiness变化使在途读与旧token失效。关闭protected草稿只应停读/保binding；真正dispose由宿主确认回收后调用。fixture原生hidden保留ready refs/草稿；换connection明确新绑定。
- 恢复持久化只有最多16条/64KiB元信息，不存文件/全文/token。lookup未命中仍unknown；精确重选原文件后原key/fullbody重试。发现已提交记录不会自动附新稿。已知记录可显式忘记本地记录，绝无center DELETE；unknown不允许清除。
- 浏览器reload验证的是本地journal重建+mock后端丢失后的404/原键重试，不是实际后端/runner重启。Send/Queue unknown及已选草稿的reload恢复尚未实现。没有声称跨tab journal原子协调；宿主必须序列化同storage namespace的写入。
- .txt UTF8 1–8192字节；总knowledge+attachments≤4/8192，knowledge在前。单upload、单list、单recovery、两正文并发；15s本地deadline即使port不理abort也释放槽位。当前目录20条、正文4份；无轮询。到期本地预检不能替代中心原子准入/retention。
- 六公共HTTP方法、权限/P01生产绑定、共享v2 ACK、实际Send/Queue全部待正式接线。这里只消费host授权的typed ports；matching IDs/namespace不能授予读写权限。Safari/Firefox、屏读与真实center尚未验证。

## 发现与修复

首轮[module测试](module-first.log)暴露accepted含replayed而receipt严格shape不同；保留整体accepted解析，再取确切receipt字段。首[类型失败](types-first.log)已修。浏览器首次发现Dialog表单submit沿React portal冒泡到Composer，误清草稿；Picker现在stopPropagation。后继发现composer清理不能删除尚未附入composer的恢复上传，现只清理曾由composer持有的IDs，并有直接回归。其余filechooser大小写/dropzone定位及模拟lookup多余replayed属于fixture问题，原失败日志/结果保留，不冒称产品均失败或抹掉失败。

最终技能与clean-code见[quality](quality.md)，正式接口见[interface](interface.md)。唯一状态与独审入口在[status](../../../plans/wpf-attach-i01-input-preview/status.md)/[review](../../../plans/wpf-attach-i01-input-preview/review.md)。

固定审查预览：http://127.0.0.1:61261（本任务动态端口，保持服务；不会更改个人入口）。

独立审查：root APPROVED固定4c4de124（仅模块），实际17/17与9源四方哈希审计见[independent review](independent-review-audit.json)/[tests](independent-tests.log)。未独立重跑作者10组浏览器/typecheck。主线与生产接线仍pending。
