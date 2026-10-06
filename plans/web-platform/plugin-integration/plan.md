# WPF-I01 主App插件挂载

创建/更新：2026-10-06 02:50 UTC。状态accepted（实现排队）。当前准备文档owner d01_owner / gpt-6-astra ultra；后续实施拟复用workspace_panels_owner，实际转交前此处唯一准备源，转交后本目录改stub。

## 目标与已确认边界

将WPF-P01已审可信host/内建WorkspacePanels与theme接入已审WPF-M02产品App，让插件贡献在真实界面生效。对应用户REQ23～25完整可插拔方向与REQ37唯一领取；仅Web子验收，X01全栈npm生命周期/第三方隔离/CLI不因此完成。root已同意独立feature/tree/branch；不需要重复用户批准，仍须既定D04单点登记防冲突。

输入候选为M02 d47c602f3bab1fe97a9be70fd37780c2918bcfbc、P01 d81075c1220fc0305bf698d84823caa4877c2d89；M02整体已获root独立APPROVED；P01整包审查未结束，不将其候选写成已批准。最终冻结明确目标后初始化新tree web-plugin-integration / codex/web-plugin-integration，不reset旧树、不追main浮动、不merge main。精确scope与M02相交路径转交见[集成清单](../../../docs/evidence/web-platform/integration-checklist.md)。P01 plugins仍由原owner写，集成只消费稳定commit。

## 接缝与验收

窄plugin-integration模块拥有稳定navigation/theme/context stores、HostPort bridge和connection epoch；App只组合。每次换中心销毁旧host，旧activation/command/render闭包不能借新连接作用相同taskId。局部B行贡献执行绑定B，不能被当前A覆盖；reference参数必须属于该task，显式展开才detail。compose无安全bridge时明确unsupported，禁止成功noop。

保留完整官方Thread，真正message/actions放消息ActionBar而非task状态条；侧栏单task行与全nav上下文分清。至少两个内建插件同接口运行，加sample button+menu+panel证明不改核心可贡献；禁用移除贡献/监听/面板、焦点合理回退、theme回内建并清token；不取消中心任务、不清用户草稿。不是扫描data属性向DOM注入。

检查按变化范围：桥接权限/资源/连接generation单测，主App真实点击/键盘与局部错误反馈；继承M02可见pane观察预算，8chat与双split局部回归；双主题390px、reduced-motion、懒读0→1→cache，实际中心一次有界用户旅程。fixture与真实中心、owner与独立review证据分开。无新增依赖则不重跑无关全库，临时lock仍原授权例外且最终还原。

## TODO

- [ ] **WPF-I01-01** 冻结两已审完整输入，完成D04旧scope转交/新claim，新worktree与唯一plan/status/review。
- [ ] **WPF-I01-02** 实现窄App bridge与声明式slots，内建插件及诊断/设置接入。
- [ ] **WPF-I01-03** 运行局部桥接与产品浏览器/真实中心验收，记录双主题截图/技能/clean-code。
- [ ] **WPF-I01-04** 固定SHA独立review、修复闭环并交原Lead集成，不代merge main。

## 风险与下一步

当前不写实现。owner先完成M02 metadata并只读审P01 UI；主线登记返回后才开新树。潜在额外文件/host缺陷交唯一owner或D04追加，不能用worktree隔离掩盖逻辑重叠。正式实现plan从此接收稳定TODO IDs，管理目录不保留第二份进度。
