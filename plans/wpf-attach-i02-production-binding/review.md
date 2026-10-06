# WPF-ATTACHI02 review

**状态：APPROVED**

Review target commit：9eec51b72c6432b5b41df52f5b8fa783eb45e65b

Base：1c4968354dabce1e6748f3301a2e6eecd33e77d4

Reviewer：root / gpt-6-astra / ultra。独立复审时间2026-10-06 13:02:28 UTC，0 blocking，[原样报告](../../docs/evidence/wpf-attach-i02/root-9eec-review.json)。

完整范围为24声明apps路径（15生产+9测试，既有queue test未变），26scope已核无越界。Root完整读Picker/CSS及定向browser差异，核fixed/current/browser hash、保护范围0diff与后继产品0diff，目视浅深390截图/几何388/388和11按钮≤125。P2长名溢出 **CLOSED**。

原191/191（7文件）独立结果仅按未变f82业务源复用，未冒称新全量运行；作者实际App10+1及最后2项longnames分别保留各target/hash，首长名轮人工清理与后续单上传采样器失败原样保留。未额外跑PG/browser/provider/个人服务。

**历史集成条件现已满足：Execution Lead在当前main完成context-history producer × attachment-only及mixed合法组合，原样回执见下。持久Send/Queue未知收据恢复仍待MATURE06-04。** ready草稿reload、跨tab upload journal CAS、真实provider/屏读/Firefox/Safari未验。main cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd 已正式接收；此前history组合条件由Lead实际2项PG+17项core验证完成（原样回执）。此仍是片段交付，非MATURE03大task完成或个人部署。

## 2026-10-06 12:49 root 技术独审进展

[原样记录](../../docs/evidence/wpf-attach-i02/root-f82-technical-review.json)：191/191（7文件）独立通过，source/claim、原模块和官方Thread零改、15轮cleanup、unknown重试同key/body核查通过。最终APPROVED尚待390px合法长文件名补验；首定向轮因采样器filechooser Promise异常未到布局，不是产品失败，也不是通过。

12:55 UTC长名风险已实际复现：合法ASCII及中文/emoji255单位名称导致双主题390px Dialog横向388→1740px；布局断言失败，键盘recovery/Escape及草稿保持通过。原产品f82未改，申请原模块UI两文件后修复；最终结论仍待root。

## 正式 finding：P2 长文件名窄屏溢出

Root确认f82 REQUEST_CHANGES：合法255字符文件名在390px使按钮横向溢出，聚焦恢复项会把视口内容移出。此前191项功能审查保持有效；仅最小AttachmentPicker/样式两文件修复及定向longnames复验待实施，需先取得原claim的26scope COMMITTED回执。

## 修复待复审 2026-10-06 12:58 UTC

正式历史：f82 REQUEST_CHANGES/P2长名溢出，191独立功能检查保留。新target 9eec51b72c6432b5b41df52f5b8fa783eb45e65b 仅2UI展示文件+定向browser脚本delta；v3明示新增写权。最终actual App longnames2项通过、浅深390几何和键盘恢复/草稿保持，Webtypes0；single-flight采样器失败保留，按实际ready串行后通过。新整体结论待root，不自动继承f82技术检查为最终APPROVED。

## 2026-10-06 13:02 UTC：结论更新

f82 REQUEST_CHANGES/P2历史保留；以上新target正式APPROVED关闭P2，不回写旧报告。后续仅合法metadata/main收口，产品停止写入，claim保留待主线接收。

## 2026-10-06 13:09 UTC：主线接收事实

[Lead原样receipt](../../docs/evidence/wpf-attach-i02/main-integration-receipt.json) / [owner只读24源核对](../../docs/evidence/wpf-attach-i02/main-source-observation.json)。main cde6646dbd4bcb4f42b7ef24f49f3a0cd6c714fd 与获审target全24源相同；Lead真实production PG2通过/2未选、officialUI17、root/Webtypes0，不冒owner重复测试。原ENOSPC两次import前0项和历史P2/采样失败全部保留。独审target及判定不变；个人服务未升级。
