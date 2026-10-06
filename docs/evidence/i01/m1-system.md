# M1 系统验收证据

2026-10-06 UTC。M1证明个人自托管的持久执行闭环基础；不是最终跨任务统一交流体验。Web旅程使用确定性adapter和真实中心/PostgreSQL、独立runner/CLI及整个浏览器进程；native系统证据另列，未新增模型调用。

## 真正关闭浏览器后的同任务旅程

最终[原始检查](web-system-verified/checks.json)绑定源码`de7d948f31a264bd1d4d7c2c3ad8b5582a6818c4`。Web公共POST返回202，关闭整个Chrome并记录PID与exit0；queued中心也退出并以新PID重启，受理任务仍存在。浏览器关闭期间独立runner启动并进展到人工等待，独立CLI先show再decision/watch；全新Chrome连接同任务，显示同attempt的完成、产物版本和验证结果。所有task/attempt/runner/browser/center/CLI关联和UTC时间在JSON中，不以页面刷新代替退出。

新浏览器展开前没有详情请求；首次展开产物1次，展开独立verification后累计2次。页面内容的产物SHA256与实际内容一致；verification的artifactVersion/inputDigest/result与中心记录一致。中心`flow.text/v1`独立重算本次非空文本规则；它不证明任意任务的语义正确性。取消另一个由Web提交的slow任务：关闭第二浏览器，通过CLI取消并观察exit11，第三个新Chrome显示cancelled，未发布产物。

浅/深主题均覆盖queued、重连完成、产物与verification展开、cancelled；390px深色无水平溢出。Execution Lead实际查看浅色展开和深色窄屏截图，文字/引用可读，未见遮挡。0 pageerrors，全部浏览器与临时进程清理完成。最终浅色full-page截图出现content-visibility屏外内容跳过，不能当全页可读证据；浅色视觉核对使用首次有效产物截图（Web实现未变），最终深色窄屏完整展示产物与验证。DOM断言与真实请求记录独立于截图。

- [浅色产物（首次有效截图，同一Web实现）](web-system/artifact-light.png)
- [深色窄屏产物与验证](web-system-verified/artifact-dark-narrow.png)
- [深色取消](web-system-verified/cancelled-dark.png)
- [首次完整旅程](web-system/checks.json)：源码db60ac6，只展开产物；完整原始结果保留。
- [新增断言的失败记录](web-system-final/checks.json)：源码586840f，验证内容已加载，但测试错误要求JSON冒号后带空格；改成解析result的语义断言后最终旅程通过。未修改产品代码来迎合断言。

复跑（不覆盖本轮原始记录；目录须不存在checks.json）：

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
FLOW_WEB_EVIDENCE_DIR=/tmp/flow-web-review-unique pnpm exec tsx scripts/web-system-probe.ts
```

专用本地DB `flow_web_i01`，脚本仅重建该库flow/pgboss schema；端口动态分配，不占4320看板。使用现有Google Chrome、Playwright1.63、Node24.20。fixture不是内存HTTP模拟服务器；本次通过真实中心和持久PG。测试会清理临时runner文件，数据库测试记录可保留，不适用于生产库。

## 原生模型证据与边界

[native-system.json](native-system.json)原始SHA256 `a7bb54d3b0ec9b2204846b5aaab6e50664493d5a4976299f7e46c7357ab71587`。执行时核心源码c08506b；query4批准受门控Read后，随机未知材料的产物通过独立contains验证；query5人工等待时取消，无产物，usage unknown。系统2次加R02对照3次，预算5/5全部使用，此后没有新增真实调用。

原始native运行之后6434fba仅修probe cleanup，类型/只读review通过，未重新耗费模型验证cleanup。SDK成本为estimate；原生插件/技能仍加载，不宣称全部资源关闭或OS安全隔离。详见[R02](../../evidence/r02/README.md)。

## 检查与限制

整合Web/D01后的`pnpm check`：typecheck及93/93测试通过，9个测试文件，包含5个真实PG/跨进程I01场景与10个C01测试。Web生产build通过。W01原5组浏览器fixture与D01原10Node/6浏览器证据已有独立review，不重新复制其完整验证声明。

6434fba历史总检83/84唯一失败是C01硬编码4320与正在运行的看板冲突；948e6bc改用系统动态端口，先受影响SSE1/1通过，随后总检93/93通过。没有停dashboard或加重试掩盖冲突。最终checks/build输出保留于本目录。

浏览器关闭、queued中心重启、runner故障是三个不同承诺。active原生query不能透明跨中心重启恢复；runner失联转uncertain并保留占用，不自动重跑未知副作用，核对恢复入口尚未实现。没有跨机器、掉电、100+真实模型并发或生产SLO验证。M2优先统一跨任务决策/解释入口；任务页仅作下钻。
