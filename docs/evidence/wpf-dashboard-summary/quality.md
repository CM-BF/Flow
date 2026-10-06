# 技能与clean-code

2026-10-06 11:44:35 UTC 启动：本任务为已批准的有界改动，不重新设计审批。按find-skills本地优先，使用已安装[技能锁与内容hash](skills.json)，无联网安装/升级。clean-code安装来源锁为sickn33/agentic-awesome-skills；文件自身历史header不覆盖安装溯源。

实际应用：codebase-design保humanOverview单一事实投影与app DOM呈现分工；只消费已解析known关系，不再推断父ID。clean-code检查小纯筛选、命名、输入不变/错误未知、复用现弹窗，不建菜单框架。webapp-testing采用现Node Playwright fixture和真实public页面（保已有工程方法，不新增Python工具层），显式状态等待/焦点检查/cleanup。brainstorming归bounded，沿用户及root已批准最终方案。

启动停点：尚未写实现或运行测试；候选/交付再检查职责、重复、无必要抽象、释放和真实行为证据。
