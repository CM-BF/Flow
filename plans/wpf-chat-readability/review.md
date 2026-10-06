# WPF-CHATREAD01 Review

**状态：REQUEST_CHANGES**

Review target commit：b9db679e403fb2a814261cdc9b68f462b31b65b7

Base：32c371d389a913f8dd71c3bd8b98dd0697411256。范围为[status](status.md)七实现/测试路径；metadata单列，不继承先前stream/profile批准。

独立审查说明：核tree/branch/head/dirty/claim，对固定target读全部diff；验证无命令/runtime/shared行为更改、异常折叠外可见、profile锁定与newchat选择、modal/Disclosure键盘和回焦点、正文与composer尺寸证据、Enter/Queue/IME/ShiftEnter/新draft、双主题390。核真实运行sourcehash及前后相同fixture条件；失败交唯一owner，不改其他树。

当前未执行独立review。预期限制：0真实模型/DB/个人服务联调；fixture非生产provider；不称性能预算达标。发现/修复/复审绑定实际commit后记录。

作者交付：Web tsc/build与dev7/prod7通过，七hash绑定fixed target，执行时fce5+dirty见[validation](../../docs/evidence/wpf-chat-readability/validation.md)。独立结论尚未给，保持NOT_STARTED。

## R1 / P2 · modal导航遮挡目标

Root固定b9db独审在55616/CUA34实际复现：Conversation3→Conversation settings→Execution history→Execution turn1→Inspect turn1，后台Task workspace打开但modal与inert仍在，焦点仍Inspect；Open task controls也令URL变#task=chat-3-task-1但modal遮挡目标。两个原正文action移入modal后缺关闭/焦点交接，是blocking。旧报告通过未包含实际点这两入口，保留原证据。修复由唯一owner在原9scope执行，新增两入口/草稿/目标可交互回归，固定新target复审。
