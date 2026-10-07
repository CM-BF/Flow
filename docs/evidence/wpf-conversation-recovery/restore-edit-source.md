# RECOVERY-RESTORE-EDIT 源码修复

2026-10-06 20:01:25 UTC。输入0ac929040ff6b0347157aa7a0cb28d9966673e1b / 7ca父监督；权属为19:46:19.159Z原6ff v4/21。仅八源码与own metadata，没有新运行。

- RecoveryWorkspace在任何await前独占view。完整可编辑稿fingerprint和通知失效位共同阻止迟到Restore；A→B→A也不能重新获得旧租约。P01 active、namespace与generation仍独立检查。
- 既有conversation的project是中心不可变身份，其首次读取的展示标签不当用户编辑；App在应用前核project与saved envelope。新chat的project/title与所有正文、intent、profile、有序knowledge/附件、steering都参与编辑比较。
- changed在等待期间记录变化，不丢弃；失败/冲突后保存当前完整稿。auth失效时保原namespace待存状态，只有同namespace重新授权才checkpoint，不触发命令HTTP。读取时已知draft version保留用于后续CAS。
- 私有restoreConversationDraft是真实App与定向测试共同消费的refresh→leasecheck→同步prepare/apply seam；App仍唯一view/editor owner，projection仍原读取authority。三个材料owner只拆同步预检与提交，旧restore入口复用；不新增store/公开协议。preparer闭包只供同一同步调用栈消费，不是持久操作/新命令。
- 同view并发Restore与重叠新draft handoff明确拒绝。全部材料先预检再写选择与editor，steering目标/权限/容量检查不再晚于正文写入。

Root澄清：Restore冲突本身不删除或套用旧record；保当前完整稿并按原stable owner/slot+CAS正常checkpoint。新稿成功保存会正常替换该slot，不要求永久留两份、不fork新身份。

新增12个源码case：六种deferred real projection refresh期间编辑（text/intent/profile/knowledge/attachment/steering），新chat project在list等待期间编辑，edit→revert，未变+初始化通知，同view并发+handoff，auth namespace=null→重认证，actual steering preflight失败。现40个普通it+6/2/2参数展开=50，均NOT_RUN；旧38只绑定7cc受控端口结果。真实mounted App/composer、IDB与browser仍待实际窗口。

历史预算不变：direct6868/30000ms、余23132；types52814/60000ms、余7186；browser14846.267375/90000ms、余75153.732625含15000清理。首10raw17415B失败保持；新源码不冒旧绿。完整feature NOT_STARTED/targetUNKNOWN，main未接。
