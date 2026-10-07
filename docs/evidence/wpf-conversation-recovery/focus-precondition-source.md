# 附件Dialog关闭后的键盘检查前置

记录时间：2026-10-07 05:15:09 UTC。固定source `1bc4f20b9257b294adcadd6b68b1b9e015e04e86`，仅原browser两行：最后Escape后 `expect(picker).not.toBeVisible()` 与 `expect(files).toBeFocused()`；Files焦点来自现宿主onCloseAutoFocus，测试不手动补focus。原count2、两个chip focus与saved/later tooltip、顺序/原record/refs/不读全文/不POST断言全部不变。18其他source不变，完整parent/fixture/业务authority不变。

[只读诊断](tooltip-focus-readonly/report.md)及[audit](tooltip-focus-readonly/audit.json)保持原件；可达关闭回调竞态不是已证唯一根因。原第四FAIL/无失败DOM事实不变。Root [限定source review](1bc-focus-precondition-root-review.json)批准本两行前置，非运行通过。

[场景依赖提案](browser-scenario-seams/report.md)归原RECOVERY01-05/MATURE06-04：完整恢复链保留，独立单选须新context且新自有服务端数据，不在失败污染状态中catch继续。selector未实现，第五次packet暂停等待选择；当前0测试/types/HTTP/PG/Chrome/free/新gate，旧50/serialization10不复跑。下一整数总额最多35116ms含15000ms清理。
