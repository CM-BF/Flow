# SVC06 工程方法

2026-10-06 13:02 UTC。stack: Node24 ESM / pnpm9.15.4 / macOS arm64 / PostgreSQL。复用本机 find-skills、codebase-design、clean-code、tdd，路径 `/Users/citrine/.agents/skills/<name>/SKILL.md`。clean-code 来源依既有固定 sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重新安装。

实际应用：prepare/verify 是 artifact 的小 Interface，安装/清单/Node dylib复杂度私有；生命周期接入复用现有唯一 maintenance operation，不造第二状态机。已授权测试 seam 为公开 prepare/verify、maintenance CLI 与实际生产 server/runner 子进程；先红后绿，不重跑业务全集。错误保存 stage outcome 后才清理；未确认不宣称停止。

初步 clean-code：区分安装身份与运行根，避免放宽 config.repository 校验。构建环境显式隔离 HOME/npmrc 与 scripts，不把文件复制等同可运行闭包。未解决：实际 artifact/host 实现与验证待完成。

2026-10-06 13:12 UTC，段落复核。artifact / host 分工已实施，未把外部工作目录当运行根；两者的状态仍由单 maintenance.json / state.json 持有。发现并修复：pnpm store-dir 自动附加 v3 的布局、失败时安装 stdout 未保留、pinned 安装后省略选择仍应沿用既有 artifact、artifact bootstrap 必须先核全部 retained Web compatibility（缺 pointer 拒绝）。原普通copy ENOSPC与clone路径失败保留。共享空间门槛提升至2.5GiB（非预留）；完整构建待恢复。brainstorming 此为已批准有界方案，复用Lead/用户既有设计授权，不发起重复批准或额外plan。尚未独立review、未完成生产入口验证。

2026-10-06 13:26 UTC，交付安全点实际重读本地 find-skills/codebase-design/clean-code，未安装。复核 prepare/verify 与 host 的单一职责、安装身份、保留预算、失败保存及错误未知语义。最后修正把 manifest 字节纳入单产物和保留上限、固定 exported tree 身份；相关 verifier 2 个检查和 12 个 JS 语法检查通过。检查记录区分历史 offline 检查/最终门槛，修正第二次 full build 的推断原因表述。未运行 journey 草稿另存文本，不把草稿当测试。只读缓存核算降低候选文件数但不伪称峰值/闭包已验，仍保留资源阻塞；待独立 reviewer 核小片，不做作者自审通过声明。

## 2026-10-06 15:16 UTC 闭包纯模块工作段

实读本地 find-skills/codebase-design/clean-code/tdd，复用原技能来源，不安装。选择图、CAFS身份和暂存字节分别内聚；无通用解析器注入或第二installer。深Module隐藏peer/平台/路径/预算校验，测试只经三个已授权Interface；JSON投影明确原源不变，错误拒绝而非补网络/放宽。复核发现需要固定字典排序而非localeCompare，已改，相关7再次通过；未添加产品后门。正式parser/builder真实安装未解决，保持open。Node24纯测试、固定锁readonly和语法是本次全部检查。
