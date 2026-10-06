# SVC06 工程方法

2026-10-06 13:02 UTC。stack: Node24 ESM / pnpm9.15.4 / macOS arm64 / PostgreSQL。复用本机 find-skills、codebase-design、clean-code、tdd，路径 `/Users/citrine/.agents/skills/<name>/SKILL.md`。clean-code 来源依既有固定 sickn33/agentic-awesome-skills bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5，不重新安装。

实际应用：prepare/verify 是 artifact 的小 Interface，安装/清单/Node dylib复杂度私有；生命周期接入复用现有唯一 maintenance operation，不造第二状态机。已授权测试 seam 为公开 prepare/verify、maintenance CLI 与实际生产 server/runner 子进程；先红后绿，不重跑业务全集。错误保存 stage outcome 后才清理；未确认不宣称停止。

初步 clean-code：区分安装身份与运行根，避免放宽 config.repository 校验。构建环境显式隔离 HOME/npmrc 与 scripts，不把文件复制等同可运行闭包。未解决：实际 artifact/host 实现与验证待完成。
