# X05 持久包下载操作

创建/更新：2026-10-06；in-progress；父[X01](../x01-plugin-management/plan.md)。唯一owner assignment_review / gpt-6-astra。GO已批准A方案：持久fetch→明确版本/artifact关系，0模型。

只owner稳定key受理，PG先commit，网络TX外。复用X02固定version/声明SHA256与现command幂等helper，不改变同步不可变plugin_operations。新023保存下载operation、最多3attempts和有界audit；X04提供host-only预分配artifactId，完整receipt原子发布。PG/final ACK丢失按已知ID重核恢复；没有目标的在途任务转interrupted，不盲重下。显式retry创建新attempt/temp，reconcile只读现artifact，均持久审计。

center本机私有root+storeId，registryRef白名单由host配置，URL/digest准入绑定，其他host不能执行/重试本机操作。默认并发1，专有PG advisory session lock覆盖一个worker，所有worker状态写通过持锁连接；网络不占事务。没有runner文件分发/解包/脚本/安装/启用/信任/依赖闭包。仍8MiB/1MiB与15s协作signal，非硬OS期限。

- [x] X05-01 claim/合同/三件套与共享Interface。
- [ ] X05-02 持久受理、查询、retry/reconcile及审计。
- [ ] X05-03 本机worker、known-ID原子发布/重启恢复。
- [ ] X05-04 真实PG/HTTP+独立进程+loopback窗口、旧X04消费者与clean-code。
- [ ] X05-05 固定证据、独立review、共享挂载/CLI与main接收。

未实现时保持未知，不把artifact_verified关系叫已安装插件。后继只读研究候选：官方npm精确版本endpoint与abbreviated整packument的字节/身份/完整性比较；本次仍沿X04整packument1MiB，不追加网络实验。
