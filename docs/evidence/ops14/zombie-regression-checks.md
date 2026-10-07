# 历史观察与当前状态：定向验证

固定 `715525e4d1510b89be7e71a236d537b1f2953038`，仅一条 regression 与 Interface；共享实现 `725bad90…` 未改。准备获 Lead 源码批准后按 OPS14-REGRESSION-0236 单次许可执行。实际4选中/4通过，12未选，其中新1与既有3直接邻例；不称重新跑完整16例，也不重跑原probe。

实际 unittest 1.135s，监督1299ms，完整入口工具1.47183675s；outer/test exit0、outer absent、stdout/stderr EOF，无监督failure。stderr1324B保存2条ResourceWarning：两个故意保unknown/signal-denied的Popen对象在其用例finally收尾前析构报告still running。原输出保留；两用例finally各自 bounded stop/reap/absence 检查完成，全部用例通过。活descendant用例亦检查leader/descendant absence。没有另查历史PID或伪造无警告。

新用例证明历史EPERM仍记录unknown、信号列表为空；真实自有reap后OS只读ESRCH使最后owned_state absent。永久不可观察、signal unknown与活后代保护仍通过原直接断言。它不把signal failure清零、不更改身份unknown或逃逸边界，不修caller私有状态。0PG/Chrome/provider；局部槽已即时归还。
