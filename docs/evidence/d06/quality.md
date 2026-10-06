# D06 质量与来源

2026-10-06 04:13 UTC：按本地find-skills发现Node静态图数据/架构文档/浏览器验证已有codebase-design、clean-code、webapp-testing；无新安装。已读brainstorming，采用已授权有界修正，保留现renderer/数据Interface，避免重新设计。技能绝对路径与本地文件hash见[skills.json](skills.json)；clean-code沿用全局固定sickn33/agentic-awesome-skills来源版本，不重复安装。

codebase-design用于保持策展数据这一小Interface、局部验证source与FSM语义；clean-code检查命名/责任/错误边界与无必要新抽象；webapp-testing采用现有loopback server动态端口、先读DOM再交互、保存真实截图。基础工作已实际核D05 v2释放和D06 v1take，新tree原先不存在且base8f/clean；读AGENTS/plans/README。root及w01提供固定8f只读研究，owner仍以本树源码核对，不把研究当已运行测试。

本段发现：旧图3773的O01/I01 planned已过期；PG detail与assistant来源缺少清晰说明；状态图规则文字正确但部分活动态完成/失联箭头缺失。修复在本任务授权两个文件中执行，初始检查NOT_RUN。

04:18 UTC 工作段/交付前clean-code：保留既有纯数据Interface与renderer，未新增状态/抽象/动态扫描。把三活动态共同completed规则汇合为明确“事件分流、不是新状态”节点，减少漏边；重路由verification pending→failed，避免穿过passed让图误读。安全retry用独立newtask节点与条件，不把实际运行边误用“编译依赖”虚线。模块命名区分中心conversation、native session、trusted浏览器host和PG registry。源记录与后继能力分开，无未解决本范围finding。

事实纠偏：root/worker先将R04联想到runner并发、P03联想到持久input-required；本owner核固定8f registry原标签，分别为“中心有界停机”和“外部协议传输优化”，root接受更正。图保留串行runner和无持久input-required这一源码限制，不给它们虚构task编号。此研究为只读输入，实际图修正由D06 owner执行。

实际检查过程：首次Node测试因新树未安装pg失败（0通过），用既有锁offline/frozen安装77包后环境恢复，无rootlock/manifest diff。新增语义测试一次误取description而文字实际在locality，修正字段后5/5；浏览器第一次innerText只读到折叠summary，改为textContent核固定SHA，并使用现有theme select。视觉检查发现verification箭头穿过passed、retry标签近节点，已修数据route并重跑5Node+浏览器。最终产物见validation；没有删断言或以换图掩盖失败。

04:20 UTC 独立review收口：Root D06-R1 P3发现nextbackend source实际应指固定registry，ef42277只改一行。owner重跑5Node与单hrefChrome，root实际CUA复验关闭；w01独立d5源码/5tests通过。clean-code再次检查事实命名、来源与无关复杂度：没有为source小修扩renderer或重复全套。最终源码冻结，待Lead登记/集成，不继承未来main能力。

GoalOwner额外目视modules-light/data-dark无阻塞。其建议将短基线SHA/固定快照提示移到标题旁，属于后继renderer/标题scope，当前仅记plan，不越权修改或重跑图；root ef批准不变。

04:29交付/集成停点：实际origin/main4e0289f与ef祖先检查/两实现diff0，4320真实47源D06卡、claim/proof/检查/review完整且architecture-data.js已是8f新图。固定图基线保持8f，不追movingmain；metadata历史3/4+dirty采样原样保留，当前完成按源文档更新。无新产品/浏览器重测，无未解决本范围finding；后继标题提示不混成此次实现。
