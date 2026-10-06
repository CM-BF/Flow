# WPF-CHAT01 首批交付入口

固定实现：`84242ca1d214f9a9ff369b07c13657918862f226`；完整Web审查基线：`b5844442699733558a152c12392ea78f26c393a4`。不能把中途输入746当作全部实现基线，早期`0d4e050057b9204ea761541d7847b9932331a519`的outbox属于本feature，须完整审查。`bac6a6e`（合同4c）、`a3b9cfa`（841精确compat）、`746364e`（a780+2e精确typed合同）是Lead授权的固定共享输入；详见[provenance](inputs.md)。本owner未合main。

- [计划](../../../plans/wpf-chat01-conversations/plan.md)、[唯一status](../../../plans/wpf-chat01-conversations/status.md)、[独立review](../../../plans/wpf-chat01-conversations/review.md)
- [验证与复用边界](validation.md)、[技能与clean-code](quality.md)
- [浅色桌面](conversation-light.png)、[深色桌面](conversation-dark.png)、[浅色390px](conversation-light-390.png)、[深色390px](conversation-dark-390.png)、[配置来源分层](conversation-settings.png)

## 保留的预览

http://127.0.0.1:63743/，owner workspace_panels_owner，exec session14932。**HTTP fixture模拟、无真实中心/SDK/模型**，页面有fixture标记；固定代码提交后服务继续读取同一源码，用户/Goal Owner可见tab保持。不要暗换成真实模型或停止它。恢复命令在本worktree运行，端口动态分配，以stdout为准：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm exec tsx apps/web/test/conversation.fixture.ts --preview
```

旧M02 http://127.0.0.1:49922/ session17885与I01 http://127.0.0.1:55049/ session79831也保留；测试只清理自己新建的临时服务。

## MainLead 真实中心验收入口

本轮Web作者**0次模型调用**。真实两次query由MainLead在固定集成main执行；其中心、runner和认证预算不由本fixture替代。Lead报告真实入口main `8f1481df880cf5077e1ddb9a8f302fe700a7ece8` 已包含批准CHAT01/CHAT02/公共输入，尚不含本Web候选。共享合同与746字节一致；不要为消费Web重新手改公共源。

在集成后的Web工作目录，用Lead实际分配的中心URL替换下面4317示例（4317只是Vite现有默认，不声称本轮有服务在那里）：

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH FLOW_CENTER_URL=http://127.0.0.1:4317 VITE_FLOW_FIXTURE=false pnpm --filter @flow/web exec vite --host 127.0.0.1 --port 0
```

`FLOW_CENTER_URL`仅配置Vite `/api`代理目标；浏览器“Center URL”留空使用同源代理。也可填实际中心URL，前提是中心允许该浏览器origin。把Lead已有owner token填入“Owner token”密码输入框，点“Connect workspace”；token仅存内存，不打印、写入源码或证据。实际生产构建应使用`VITE_FLOW_FIXTURE=false pnpm --filter @flow/web build`；本证据用true构建的fixture包不能当真实配置。

公共请求仍固定`harness=claude`、requested `runner-default / disabled / configured-readonly`。折叠详情将conversation.requested、runnerRequested和effective分别展示；工具数组表示adapter报告的可用工具，不是已执行调用，空数组显示0 tools，null显示Unknown；thinking unknown不推断，整conversation/resume累计usage Unknown。实际runner模型与工具由Lead独占manifest核对。

稳定Playwright入口（现有浏览器脚本是模拟服务专用，不会自动调用真实模型）：

```ts
const pane = page.locator('.flow-chat-group.focused .flow-tab-body:not([hidden])');
await page.getByLabel('Owner token').fill(process.env.FLOW_OWNER_TOKEN!); // never log
await page.getByRole('button', { name: 'Connect workspace', exact: true }).click();
await pane.getByRole('textbox', { name: 'Message input' }).fill('hi');
await pane.getByRole('textbox', { name: 'Message input' }).press('Enter');
// Or click pane.getByRole('button', { name: 'Send message', exact: true }).
const replies = pane.locator('[data-slot="aui_assistant-message-root"] [data-slot="aui_assistant-message-content"]');
```

首ACK后URL为`#conversation=<id>`，后续发送留在该id；受理和执行中composer仍可编辑，capfalse时只禁发送。等实际assistant正文与发送按钮恢复后提交第二次query，不用revision变化等异步回复。刷新页面后重新提供owner token，原hash恢复中心持久conversation/turn；也可从“Conversations”navigation选择标题。

`Read full reply`只在`truncated=true`存在；首次点击发`conversationDetail`，`Hide full reply`再开读本连接完整身份cache。普通短回复不会为了验收强制取detail。`Execution details · N turns`及子`Execution · turn N`展开后有“Inspect turn N”（右侧Terminal）与“Open task controls”（原任务决定/显式取消入口）。未展开详情请求0；用户消息与assistant消息各有真实对应turn.task的插件动作。

## 范围限制

这批是实际公共协议上的最小持续对话Web；fixture自然正文不是模型证据。queue、steer、live text、per-turn模型/thinking/tools按首合同false明确禁用；voice、真实tool/thinking事件、后续设置、X01全产品插件管理、PTY/任意磁盘均未宣称完成。会话正文不映射执行telemetry。执行历史保留Work overview入口。

草稿和未确认outbox是本页连接生命周期内的缓存；断网、换可见tab、迟到ACK均保留，但整页重载/换中心清空本地未发送草稿与未知收据。已经受理的conversation/turn由中心持久保存；没有把浏览器缓存称为中心事实。未知收据可在当前连接用原key重试，401/403或idempotency冲突不能抹掉之前的未知状态。
