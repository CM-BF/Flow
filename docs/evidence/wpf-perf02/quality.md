# PERF02 技能、授权与质量

2026-10-06 03:33 UTC 启动。已先读本地 find-skills，React窗口/接口设计/行为测试均有相近本地skill，无新增安装。brainstorming属于已有Activity的有界变更，采用用户与管理者已批准方案，不重复审批。clean-code固定用户指定源 sickn33/agentic-awesome-skills@bdacd76ed9e388733b5f91a5c75a4e8183a7c0b5；其源内ClawForge标头按实际保留，不谎称另一次安装。

| 技能 | 路径 | 实际文件SHA256 |
| --- | --- | --- |
| find-skills | /Users/citrine/.agents/skills/find-skills/SKILL.md | `c00eeea0e13e74fe4a9d84ba0a8542205a1b736d65f13134fe1a6647eb14976f` |
| brainstorming | /Users/citrine/.agents/skills/brainstorming/SKILL.md | `74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608` |
| codebase-design | /Users/citrine/.agents/skills/codebase-design/SKILL.md | `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2` |
| clean-code | /Users/citrine/.agents/skills/clean-code/SKILL.md | `3c4115e1bc0ead5b023d9cc2c4f79f3a9273bfd363ae5c7eb11cf67f0096f317` |
| vercel-react-best-practices | /Users/citrine/.agents/skills/vercel-react-best-practices/SKILL.md | `71ed7794962fa6e803ee83030517b5b93a9f70fbfeb431ec4535c5480a8d8355` |
| webapp-testing | /Users/citrine/.agents/skills/webapp-testing/SKILL.md | `51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2` |

应用：codebase-design让高度/范围/焦点集中ActivityWindow小接口，Overview不重复DOM全量扫描；React指南采用稳定行key与适量memo、只测可见DOM、批量ResizeObserver读写；webapp-testing用既有本仓Playwright TypeScript和动态HTTPfixture，轮询公开DOM/HTTP而非私有React状态（不照搬Python模板或networkidle无限SSE）。

开工clean-code：发现原Overview每次restore/remember扫描全部已渲染记录，且全量map使DOM线性；新模块限制扫描当前窗口，全部数据与HTTP仍由现有projection负责。尚未实现/验证，不提前声称优化。

权限：D04 live于03:31:55 available，PERF02 v1 active八范围，旧M02 v3/PERF01 v2已移出；三个原receipt随本记录。安装通过pnpm help核no-lockfile语义，结果另记，不允许tracked lock/manifests变化。
