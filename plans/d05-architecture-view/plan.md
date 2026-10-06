# D05 架构视图

状态：completed。Owner：Execution Lead / gpt-6-astra ultra。Base：3773db5d014a6d38d09553acd0a5fe8df900b7c4。用户要求并由Goal Owner提供五视图验收基线。

在工程dashboard增加“架构”tab：运行边界、代码模块、数据连接、Task状态机、外部依赖。图支持选择节点读Interface/局部变更测试依据、固定commit源码链接、适配/缩放/图内横滚。20秒进度刷新不改变图阅读状态。已实现与分支开发/未实现用文字和线型区分，不增加任意文件读取接口或依赖。

## TODO

- [x] D05-01 固定源码基线与五视图数据，核对边界、FSM与模块Interface。
- [x] D05-02 实现可读tab/缩放/说明、双主题窄屏，保留进度能力。
- [x] D05-03 局部结构/行为/真实浏览器检查与独立内容审查。
- [x] D05-04 维护规则、登记、合入与4320实际切换。

## 技能与设计

find-skills本地优先，已读frontend-design/codebase-design/clean-code/brainstorming/webapp-testing。本项是既有dashboard内有界视图，按用户直接实施和Goal Owner已明确内容方案，不追加形式化许可。沿用中性浅深tokens与系统字体；大图为主、右侧解释，窄屏上下排列；绿色Flow、外部虚线/文字、开发中独立状态标注，不仅依赖颜色。SVG原生无需新增图形库，静态已核数据与renderer分离，保持模块Interface小而可测。
