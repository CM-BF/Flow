# Workspace cache 依赖保留：本组有界确认

**本组已知使用与冻结输入确认完成；依赖操作仍由 Lead 另审恢复方法后裁决。** 本次只涉及已交付/释放的 `web-workspace-cache@10ca8eef`，此前 `.vite` 确认没有被扩大为依赖许可。

- [manager 正式确认](manager-confirmation.json)：fresh D04 883321bc v2 RELEASED、固定树 clean；原 owner 六个文档/入口 hash 已核。
- [原 owner 上下文](original-owner-context.md)：无本组常驻、未结束、已排定重放或自行设立的外部 donor 保留要求。旧脚本仍会消费本树安装，不能因旧检查通过就忽略它。
- [root 冻结依赖复核](root-frozen-dependency-review.json)：Recovery/DPERF/已交 Settings 的66个精确依赖 realpath/hash 无命中。QuickControls 仅源码阶段，未来尚无运行绑定，不给未来依赖保证。
- [Lead 原审计](lead-dependency-audit.json)：581包/29,606 payload 与本地CAS匹配；当时kernel无命中，四个允许根无导入本树的symlink。这些是限定范围、时点和来源，不是全局不存在消费者。

**继续 KEEP：** 全部source/test/rules/plans/ownraw/Git、manifest/lock/CAS、72 generated shims/layout、root `node_modules/.vite`、未经另批的目录/链接布局及未知消费者。CAS内容可取性不证明可精确恢复完整安装，也不代表物理收益。

若 Lead 后续决定移除经核定的payload，旧树必须标为 **NOT_RUNTIME_READY**；任何重放先需另行批准的 exact restore-before-run 与验证，再fresh运行准入。此确认未停止、删除、恢复、安装、import或执行任何产品，未采进程/空间，也不授任何运行或清理权。
