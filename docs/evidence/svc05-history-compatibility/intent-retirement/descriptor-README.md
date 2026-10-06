# 保留产物描述符比较窄修

源 `6e7109c47b41ae6d45fdcc9a8ef365375dcd2736`：仅私有preservation中同一个artifact三字段比较，以及新3个纯检查。对象键集合必须精确artifactId/manifestDigest/sourceHead，值必须相同字符串；键插入顺序无语义。release.artifacts仍严格有序数组，不能换顺序、缺成员、加成员或未知字段。全局JSON比较、旧data摘要/文件bytes/hash/compatibilityId与其余规则不变。

原21:18窗口只01 observed、02retained=false/exit1，03后零动作；raw/analysis/manifest不修改。本轮直接读已保存01执行纯比较：原第1case重现false，另2case因新增helper尚未定义红；随后3/3绿/116ms。0个人probe/PG/Chrome/provider/tmp数据，fresh1158791168B≥1GiB+4MiB，raw429B，测试组已退出；累计新3不同，原18未重跑。发布列表检查验证同一实际comparator helper，不称真实发布。

2026-10-06 21:21 UTC clean-code复核：仅artifact tuple领域比较封装，一处复用于retained与发布列表，无全局JSON规范化/没有放宽键集合。原许可/新窗口不可复用；本修正待Lead增量独审，个人发布尚未开始。
