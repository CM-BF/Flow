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

## 2026-10-06 03:39 UTC 实现段 clean-code

固定 `a87f64f48a3b7e8d03429ab0673c210076a2df0d`。复核单一职责、命名、接口、错误、重复、React identity：高度索引/锚点/焦点/可见行在ActivityWindow；原Overview全DOM扫描删除。测量读取只遍历当前窗口，ID map查找，稳定row key；焦点独立挂载不扩大整个区间。原header ReactNode effect依赖曾造成恢复过频，改实际尺寸观察；重排变高导致原offset超出新row时clamp在同ID末尾。开发失败与修复如[记录](development-failures.md)，没有降hash/焦点标准。13 tests（3窗口算法+10直接projection）、Web typecheck、8 production功能browser通过。1040变高条全部cursor/id/body hash一致，最多16挂载；双主题390实际目视。

安装最终仅web+server测试直接依赖+root offline no-lockfile，0下载，rootlock/manifests差异0，本树client/contracts链接均指本树。未声称缓存/驻留非线性；height map/prefix仍随已加载记录增长，projection未改。screen reader/Firefox/Safari未测。

正式计时先等待root协调B01/EXPLAIN结束；功能browser不是正式性能样本。probe方法改动：只改新输出目录/准许的3生产路径guard；原DOM全量断言替换为公开total/lastcursor+挂载上界；新增完整DOM历史遍历单独phase，保留前置详情0→1→cache、8chat观察和原键盘/wheel/phase采样。计时后的完整性hash不混入旧timing数组。
