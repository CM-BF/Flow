# CHATUI01 流式正文界面验收准备

状态：in-progress。创建/更新：2026-10-06。阶段：M2。owner：chatui01_owner（gpt-6-astra），lead：Mika。

## 目标与边界

用同一浏览器旅程准备零模型 actual App HTTP fixture 和一次真实 query 的候选接口。只操作独立 Chrome 与动态端口 fixture；不调用真实模型、不操作个人服务/用户页面，不修改产品源码。真实候选最多 1 SDK query / 2 turns / USD0.20 / adapter60秒，尚无 permit；O10 预算已封存。

## 已确定设计

当前 focused visible pane 内同一 data-stream-status 身份至少3个非空严格前缀样本（2次增长）才可报告 PROVEN；HTTP 仅协商和身份旁证。typed final 与 settlement 的 task/attempt/session/message 必须匹配；replace 集合不可再见、retain 集合有正文者仍可见；保留未发送草稿且无虚假 Previous/Next 分支。typed final 可早于任务 terminal，分别记录。

准备入口必须固定源码组合和配置，持久 wx reservation 后最多放行1次 create及1次turn，未知/失败不重试。checkpoint 先 fsync 再清理自己的浏览器/fixture；凭据只在内存并脱敏。真实 Web 需绑定实际 critical files，sourceAtStart 不能证明 Vite 加载内容。

## TODO 与验收

- [x] CHATUI01-01：核空闲领取、独立worktree、技能与首状态。
- [x] CHATUI01-02：收敛可审通用旅程、持久证据与一次 mutation guard；零模型 unit checks。
- [x] CHATUI01-03：同driver跑实际App、合成HTTP流，记录两次真实DOM增长/结算/草稿/清理。
- [x] CHATUI01-04：固定源码和证据、独立review、及时commit/push与主线接收。
- [ ] CHATUI01-05：另行取得一次真实query窗口后执行；本次准备不标完成。

## 取舍与结构影响

复用既有流协议解析器与HTTP fixture，不重复作者全矩阵。新接口仅在 experiments 中，产品Interface/FSM/数据库/外部依赖边界不变，当前无架构图更新target。实时验收许可与静态Web发布由Goal Owner/SVC03负责。

## 验证与风险

Node24/pnpm9.15.4/Playwright1.63.0；选中guard/证据行为检查和1条真实页面fixture旅程，不运行产品全suite。provider可能太快，真实流增长不足如实 NOT_PROVEN，不追加query。实际服务版本/固定静态artifact未交付不阻塞本次零模型准备。

主线接收：固定main2c6df475已包含4a442源码与canonical证据，见main-accepted.json；本次metadata后停止原3scope写入并释放claim。CHATUI01-05真实验收仍开放，0重跑。
