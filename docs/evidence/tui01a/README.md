# TUI01A：基础会话终端

所属大task TUI-001；co-lead Execution Lead；owner runner_owner/gpt-6-astra。固定实现`9e5588d4d6b24234bb829c23269e6e72caca44af`，见manifest；本分支验收不等于main已部署。0provider、0真实用户凭据/服务操作。

两个实际consumer：Ink屏幕和JSONL无界面入口共享命令descriptor/controller，经既有FlowClient受理。局部intent仅保存未决请求，不复制中心历史、provider loop或assistant-ui LocalRuntime。支持help/list/open/profiles/new/send/recover/disconnect/quit；退出不取消后台工作。使用方法见 [终端README](../../../apps/tui/README.md)，公共端口见 [Interface](interface.md)。

## 验证与原始输出

- `behavior-pages-final.txt`：17个不同测试（controller 11、renderer/journal/headless 4、真实HTTP/随机PG 2），10.00s。真实center动态端口；配置profile读取/选择不创建turn；本地代理故意丢create ACK后仅显式recover重用同key/body；合成fixture执行，实际PTY输入中文/emoji/删除/多行、resize 100×24→60×20、Ctrl-C后center仍running，另一PTY重开读final、headless读同一原文；显示OSC为可见文本。两PTY退出0、raw模式恢复，owned runner停止、随机数据库remaining[]。
- 最后只给recover的观察epoch补同样防护后，`controller-close-final.txt`11/11（重叠，不新增distinct），`typecheck-close-final.txt`为空stdout/实际exit0。前轮types和行为保留，不冒称重复次数是不同用例。
- `controller-first.txt`7/7；`epoch-red.txt`真实发现两个await边界旧epoch错误；随后公开controller修复。`behavior-final.txt`为此前16/16，新增完整菜单分页后成为最终17。
- `local-first.txt`只跑7（原`.test.tsx`不在本库Vitest include），`local-selected.txt`9/10与`renderer-act.txt`3/3含act设施警告，最终测试已消除。PTY先前3次失败与一次合并失败见journey-first/second/third、combined-first：驱动命名、粘贴输入与真实输出背压问题均保留，最终持续排空并按真实ready输入；未放宽生产保护或靠延长时限通过。

重跑仅本片，使用Node24与已固定依赖：

```sh
pnpm exec vitest run packages/interaction/src/controller.test.ts apps/tui/src/terminal.test.ts apps/tui/src/journey.test.ts
pnpm exec tsc --noEmit
```

PG工程fixture使用本机55432已有设施，但仅创建随机`flow_tui01a_<nonce>`数据库，正常收尾DROP；不触个人预览数据库/端口。Python标准库PTY是真实自有进程，无浏览器、无provider。该合成Claude命名adapter只是验证已知v1兼容结果映射，不能证明真实Claude/自然语言质量。

## 依赖与边界

`1cec921`固定2个新importer与41条新增package/snapshot，既有importer/resolved均无漂移，实际`@assistant-ui/core`仍只0.3.22。Ink8.0.0/React19.3.0/react-ink0.0.46/test4.0.0实包SRI/license/engines见dependency-provenance.json；安装ignore-scripts。offline缺缓存原始失败保留，再registry受控下载成功；锁scope已交回。TextInput为真实包独立受控primitive，不启用其本地会话运行时。

最近20turn、六项菜单页、正文显示截断是本片边界；更早历史导航、流式/工具/thinking/权限详情、queue/steer/cancel/decision、附件、实际provider验收留父task。只读轮询和known configured profile不代表provider在线。未知ACK由私有本机journal保留，显式重放；磁盘/电源故障、多设备恢复、终端恶意插件等不属本片安全证明。私有锁不自动窃取，不保证进程crash后无手工核对。真实中心公共鉴权继续由既有server执行，首片不另建登录系统。
