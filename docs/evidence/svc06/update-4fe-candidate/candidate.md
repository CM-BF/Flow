# SVC06-05 下一用户可见更新候选（只读准备）

固定研究base为 `4fe33178b17925d558b5608f1b3c4ae69b3d06d5`。已保存SVC08 r3原件仅证明06:17:15时后台af51/v18、独立Web host c7b/Flow422、d629/v3与三个保留产物不变；本轮没有个人采样，历史值不能作为下次fresh准入。

**先补实际host接入，再构建新后台，随后才新Web。** 4fe具备浏览器会话与消息设置服务端能力，但 `environment.mjs` 的center环境只传旧五字段；原baseServiceEnvironment也不透传 `FLOW_BROWSER_SESSION_JSON`。真实runService→server/main因而默认不启browserSession，读取诚实返回unsupported。外部塞环境不能绕过白名单。4fe可作功能基线，最终artifact必须绑定包含必要已审host薄接线的一致main，不能把原4fe重标为已启用。

最窄候选是受信安装目录中一个显式可选、0600/no-follow的小浏览器策略文件（无token），由host读取、核原安装身份后仅向center序列化 `cookieOrigin/trustedOrigins/authEpoch`；缺文件保持默认off，非法内容拒绝启动。原config/token/claude.json字节保持，不能偷偷新建策略、复制token或扩大信任origin。复用server既有strict语义/CSRF/epoch规则；Web代理现changeOrigin=false保留公开Host，实际组合须验证公开origin。拟独立正式scope：`tools/personal-preview/{browser-session-configuration.mjs,browser-session-configuration.test.mjs,environment.mjs,environment.test.mjs,preview.mjs}`，必要preview直接消费者在scope确认时精确追加；现在仅提案，当前v7只持自身plan/evidence。

构建复用已审SVC06 prepare/verify与SVC08 Flow来源薄入口/OPS14。固定4fe的9份dependency输入（7个package、lock、workspace）与已建Flow422逐字相同，16个root工具也列明实比；这支持复用既有选择方法，不是新cache完整性或构建成功证据。新artifact `sourceRepository` 必须真实Flow，禁止复用e5来源WT或更改c7b描述。原offline/frozen/ignore-scripts/private-store、clone/install各180s、外层420s+.5TERM/2reap、raw2MiB/live1GiB不降低；新source/stage/seed/install/final同时存在的总空间按新固定输入核，至少沿原fresh3,927,965,696B候选，执行前fresh，不能拿历史空间准入。

4fe相对af51新增SQL028–035；实际factory会在既有迁移链依次处理35（conversation模块）、028、029、034、030、031、032。033文件虽存在但此base未挂载，不能承诺完整工具正文接线已部署。迁移先在自有专库用实际factory/旧schema有代表性历史做前进与幂等验收，禁止手工补表/routes。保留原64表/既有行身份、runner凭据/profile、消息/任务历史；新增表列及必要维护audit变化须逐项事先声明，不能把所有差异泛化为允许。不做DB自动回滚，不把新schema可启动当旧数据兼容。

进入个人安装前，三个保留Web artifact `461a9732…` / `caa1e938…` / `d629631d…` 均须绑定新实际backend target的真实App兼容报告。现报告是af51，不可换tuple或用Quick组件/Story完成冒称App。Web新候选由Web原owner提供明确真实接线source/artifact及其报告；后台成功后再用现有独立Web CAS发布，不提前换指针。

个人动作仍未开启。候选流程复用原installation锁、exclusive intent、精确产物迁入/验证：全部材料与报告先齐→fresh身份/工作与保留基线→maintenance bootstrap指定backendArtifact→等待原工作完成（不cancel）→同operation hold→原refresh→核保护checkpoint→显式同op resume。**原refresh确实依次停止/重启Web、runner、center三roles**，不是仅两后台角色；它保留独立c7b Webhost选择与原d629/v3/retained指针，故原页面网络可短暂断开但不操作/刷新用户tabs。owned nonce未知或active/uncertain/pending任何无法确认，停止后继；原journal不清空，不复用过去意图退役授权。每阶段明确结果才后继，失败/unknown保留原件与维护态，禁止自动重试/重置key/DB回滚。

局部必要验证只覆盖新host策略传递/default-off/无token扩散/错origin与epoch/非法私有文件，复用已绿builder不重跑旧矩阵。实际新artifact、旧schema专库迁移+三host维护、三个保留App与最终个人更新按ready-first窗口逐步独审。当前仅此候选/源码事实；0构建、0PG、0provider、0个人读写。完整SVC06-03/04/05仍open。
