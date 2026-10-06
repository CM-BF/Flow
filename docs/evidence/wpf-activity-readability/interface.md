# Activity readability Interface

本片沿现有两生产文件的小Interface：NativeActivity接受NativeActivityProjection，订阅其只读snapshot并触发既有refresh/showPage/loadBody；ToolHeader只接title和公开status。不添加状态机、事实源、client、授权引擎、timer或provider特判。扩一个状态仍由公共contract/projection负责人提供，本显示层只做准确呈现。

- 默认：工具名与短状态、刷新、loading、stale/error与可行动恢复；input-ready只能说明输入齐备，不能称正在执行。Unknown结果未确认、Failed实际失败。原始phase在Details保留；succeeded工具不等最终task/产物验证成功。
- 按需：Provider/page解释与普通字节/mediaType/attempt/source/SHA进入原生details。截断说明、redacted无正文、unsupported与body失败保持直接可辨；不把未证实的thinking/执行补成assistant正文。
- 生命周期：只有用户展开row才loadBody；页切换与刷新仍由既有projection；同pane披露/草稿缓存、hidden/offline/跨connection失效保持原样。多个pane不共享展开state。首次单页不显示无用两按钮，多页只表示加载情况不算总数。
- 组件复用：沿本树官方Reasoning（真实body、streaming=false）及已有AI Elements Tool授权适配，固定源/许可证在只读旧docs/evidence/wpf-activity-i01，不重复安装/复制组件。
- 证据：现integration.browser保留所有旧断言，报告/截图落新docs/evidence/wpf-activity-readability；本片receipt决定三source范围，必要只读依赖单列，不用旧take冒新授权。viewport/theme变化后等待稳定帧，记DOM尺寸。旧浏览器报告不覆盖。

本片不包含App/Thread/MessageFooter/Queue或received/applied steering回执；不修改它们的语义，不声称整个普通用户聊天信息层级已完成。纯显示改变无新网络读取；0真实模型、DB或个人服务变更。
