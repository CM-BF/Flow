# MATURE06-LAZY01 惰性 reasoning 读取

创建/更新 2026-10-07T07:22:19.802Z，状态 in-progress。所属[WPF-MATURE-06](/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/plans/wpf-mature-06-chat/plan.md)，co-lead mika，owner status_read/gpt-6-astra。此片追溯父06-03，不创建大task。

目标：默认持续正文和完整轻metadata，折叠reasoning正文网络0字节；显式展开后首次verified GET和活跃增量。保持来源/游标/身份、v1/v2兼容、取消和final语义，有限累计resident缓存。设计与边界见[Interface](../../docs/evidence/mature06-lazy-reasoning/interface.md)。

- [x] LAZY01-01 固定base、独立树、metadata领取与小Interface。
- [x] LAZY01-02 正式领取六core/三tests后实现选择协商与单projection生命周期。
- [x] LAZY01-03 必要局部行为/strict及独立review，不以mock代HTTP字节证明。
- [ ] LAZY01-04 client共享接线与受控专库HTTP验收；Web owner衔接明确。
- [ ] LAZY01-05 受控main接收与dashboard/架构事实同步。

初始setup≤10min/source物化≤4MiB/meta256KiB，0工程运行；后续core段≤20min/source+meta1MiB/TMP8MiB/raw256KiB/最多4child各60s且保1GiB，不与Mika另一local并跑。真实PG/browser/native/provider/install不在本段。不可因共享入口待交接宣称完整vertical完成。
