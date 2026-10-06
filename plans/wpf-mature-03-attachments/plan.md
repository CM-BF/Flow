# WPF-MATURE-03 附件与文件上下文真实发送

| 字段 | 内容 |
| --- | --- |
| 大task ID | WPF-MATURE-03 |
| 状态 | in-progress；完整验收未完成 |
| co-lead | Web /root（执行管理 d01_owner） |
| 优先级 | P1 |
| 唯一来源 | 本目录plan/status/review，管理worktree合法claim v3；不另填聚合进度 |
| 用户来源 | [成熟度原话与六项分工](../../docs/evidence/web-platform/mature-task-handoff.md)；原WPF REQ仅追溯，不形成第三层 |
| 收益 | 用户可通过按钮、拖放和@file把明确版本的材料附到当前草稿，并真实用于Send或Queue执行。 |
| 边界 | 本计划定义完整用户结果；具体实现须独立worktree、fresh精确scope take和固定独审，计划目录领取不授产品写权 |
| 依赖 | CONTEXTI01独占20scope；本地上传/runner文件与授权/版本合同由相应后端owner提供，接口缺口明确后协调，不自造prompt或目录权限。 |

## 已有能力与gap

CONTEXT01选择模块736ef和CONTEXT02深冻/ACK guard5e821已main；K01/K02提供不可变版本citation、cap及project身份。CONTEXTI01固定d7e已take55fe，当前实际UI未验收。

尚缺：实际知识UI；附件按钮/drag/@file入口、预览删除、允许类型/大小/权限、可追溯固定版本送入model context；本地上传与runner文件不能用知识模块冒充。

当前子任务唯一来源：[CONTEXTI01](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-integration/plans/wpf-context-i01-integration/status.md)。该子任务直接归本大task，WPF管理只做来源追溯。

## 稳定TODO与完整验收

- [ ] **WPF-MATURE-03-01** 完成已有知识实际UI子任务：CONTEXTI01从已授权project创建、cap确认后选引用；Send/Queue ordered tuple到真实HTTP并校ACK；不宣称本地上传完成。
- [ ] **WPF-MATURE-03-02** 冻结附件与文件公共接口：区分本地上传、已有知识、runner文件的来源/版本/权限/大小类型，绑定当前project/view/connection；timeline只轻引用。
- [ ] **WPF-MATURE-03-03** 实现按钮拖放与@file：三个入口可发现；键盘替代drag；搜索有界且可取消，预览正文按需，删除只影响当前草稿。
- [ ] **WPF-MATURE-03-04** 保证发送与重试身份：同一次Send/Queue深冻材料版本/顺序；unknown保原key/payload，预算拒绝保留receipt，ACK不得清新稿/新refs；材料真实进入model context。
- [ ] **WPF-MATURE-03-05** 验证多窗口与失败恢复：双split草稿独立、换连接/close/隐藏/撤权迟到隔离；不支持中心明确plaintext路径；类型/大小/授权失败可行动。
- [ ] **WPF-MATURE-03-06** 完成实际旅程验收：真实App fixture覆盖入口到执行请求、引用审计与按需详情；provider执行验收另经明确预算，不能拿fixture证明模型收到。

## 验证与交付规则

每个实际子task直接链接本大task稳定ID及co-lead；进度只维护其唯一status。仅完整TODO验收通过、证据环境/固定源码明确并完成受控主线集成后才可将本大taskDone；当前所有大task验收仍开放。普通片段ready/review/merge/claim不向GO发送，内部worker通信保留，需GO解决的整任务独立blocker仅一次。新scope依D04查重/原子领取，本计划不授权重启个人服务、刷新用户tab或新增provider调用。验证按影响范围，不为文档重复产品测试。

## 已安装附件接缝研究

root只读实际react0.15.23/core0.3.22：external-store-adapter.ts已有adapters.attachments，composer有addAttachment(File或CreateAttachment)/removeAttachment及submission.attachments冻结。无需预设升级SDK；[官方附件文档](https://www.assistant-ui.com/docs/guides/attachments)最新安装示例^0.15.25不是本项目升级授权。现版adapter接中心固定轻引用，UI选择/图片预览不证明上传或模型输入；不直接采用base64/PDFplaceholder例子，无个人文件上传或模型调用。

### 完整附件生命周期依赖（09:09 UTC GO审计）

需和Mika/ExecutionLead明确唯一后端owner：浏览器引用必须落为runner固定可读输入，ready才可Send/Queue；删草稿、执行前重启后仍读取冻结版。上传中、失效、provider不支持须明确阻止，不能静默丢附件只发文字；取消/失败有界清理、使用中的材料不回收。MATURE02 adapter只消费该协议，04复用metadata；本Web不重领后端范围。沿原附件TODO验收，不扩大当前CONTEXTI20scope。
