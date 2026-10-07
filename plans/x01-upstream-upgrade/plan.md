# X01-UPSTREAM-UPGRADE01 — 真实 semver 上游升级

状态：in-progress；2026-10-07。所属 X01，co-lead Mika。

目标：同一 Flow host API 1 适配器，固定 npm semver 7.8.4→7.8.5→回滚4，以 satisfies 预发布范围反例证明真实上游差异及旧材料 pin 保留。仅本地生产 prepare/read/import/invoke，不代替中心/真实 runner 进程升级。

- [x] X01UP-01 固定官方 metadata/tar/SRI/git/license 与安全提取及 bundle 闭包。
- [x] X01UP-02 相同输入 false→true→false、不同上游身份及原 pin 不变。
- [x] X01UP-03 局部 types/实际宿主行为及独立 review。
- [ ] X01UP-04 固定窄 main intake，主线接收；真实中心上游切换另窗后继。

模块：range adapter 只解析 ≤4096 UTF-8 JSON、bounded version/range/boolean 并返回布尔文本；材料/store/授权由现有生产模块拥有，不复制。官方 tar 每份≤256KiB/10s，SRI先验，拒绝逃逸/链接/超额条目。ESBuild0.28.2仅打两个包，禁止安装/脚本。

工作段11:38:39–11:58:39Z；child60s/累计120s、TMP16MiB/raw512KiB/source-meta2MiB；本组local串行，0PG/Chrome/provider。失败与未知保留。

- [x] X01UP-05 复用已审lifecycle准备真实中心7.8.4→7.8.5→4；独立review后新窗口实际验收。
