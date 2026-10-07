# SVC06 parser / builder 局部结果

记录时间：2026-10-07 02:53:50 UTC。源码 `b21890799fe11b8f1937e4b08382c997877f6d53`，增量基线 `1b41f58816341f77e69a64d1cb5cfe7650c01b49`。7个产品/测试文件，正式安装来源为 `47b1ff1db67ba109fb0ce737a42a01f2bff37433` 私有yaml2.9.0；没有新增安装/网络/PG/Chrome/provider/个人服务操作。

| 轮次 | 实际选择与结果 | 界限 |
| --- | --- | --- |
| red | 新模块第6用例1 selected，0/1，369ms | verify后原文件替换成目录，旧copy进入递归后才拒绝，保留原输出；该中间源码仅run内SHA绑定，非最终Git target |
| module-green | 6 selected，6/6，721ms | 新parser、staging、恢复原字节、缺件/变化拒绝、实际APFS选中clone和目录替换拒绝 |
| empty-cache | 1 selected，0/1，89ms | 初次TMPDIR放repo内，既有BACKEND_STAGE_LOCATION_INVALID保护正确拒绝；不更改断言或产品guard |
| empty-cache-external | 同1 selected，1/1，505ms | 仅纠正为自有外部tmp，旧固定280289源archive+缺cache路径在安装前ENOENT，未进入pnpm install |

共7个不同用例，9次执行跨4轮；累计监督1684ms/工作段120000ms。原87dc七项及其他legacy/host矩阵未重跑；没有root类型检查声明。Node测试入口直接执行MJS模块，Python实际clone检查复用了已安装系统Python。每轮OPS14 27+.5+2s、最大输出128KiB、同newChildSession与pnpm无关；结束均owned absent/EOF完整，自己tmp均空且初始identity一致后删除。

原始stdout/stderr总5766B，最大观察自有临时logical12,195,310B/allocated13,832,192B（均低16MiB），最低观察free26,564,063,232B。20msmetadata采样不是硬空间预留或精确峰值；末轮临时child有1次消失缺样，原值保留，最终tmp为空。原完整构建≥2.5GiB且保留1GiB门槛不降，不将clone逻辑量视作physical回收。

[单一结构化run记录](parser-local-validation-20261007T0252Z/run.json)同时绑定各轮源码hash、选择、exit/EOF/owned状态与实际资源；每轮原始输出保持。继承的parser私有安装证据见[安装结果](parser-install-result.json)。fullartifact、真实filtered安装、SQL/SDK延迟加载及固定产物隔离开发checkout仍NOT_RUN，SVC06-03/04/05仍open。作者本轮不自批，交唯一独立review。

clean-code安全点：复用原三个纯Module，新的IO接缝统一承担解析/投影/恢复；复制修正只针对选中单文件，不新增通用复制框架。失败原件、unknown与原guard保持，新增测试通过现有Module入口；没有依据将局部绿扩大到完整成品。
