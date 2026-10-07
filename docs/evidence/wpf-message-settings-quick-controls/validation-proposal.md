# 验证提案（未准入、未执行）

固定 target `fe6ece131c489c79cf531a184e4cf51209f9c4a0` / base `c8e2e9e56af4c3dd2975253e9e374f9ec3e09e05`。精确路径、realpath、读取到的 SHA 在 [validation-input-proposal.json](validation-input-proposal.json)。只按既有有限清单读文件，没有安装、链接、导入、build 或空间采样。

1. 定向 strict/noUncheckedIndexedAccess noEmit：复用已有 I02 TypeScript 5.9.3 只读 tsc 入口，临时 config 继承本树 tsconfig，files 四变化源+catalog/selection+必要 Vite CSS 声明。所有 @flow alias 指本树固定 packages/*/src，第三方声明走已列真实绝对路径；不借 moving @flow/dist。
2. 单文件 Vitest 4.0.18 `apps/web/test/message-settings.test.ts`：真实组件模块导出同一 opening 与 host commit seam，预计静态26展开用例（含旧16）；运行结果按 collected 数与具体名称验，不沿旧 expected20 错误计数。旧 execution-profiles 未变函数做字节保护，不重跑原37。
3. 直接测需更新旧 Vitest config 的 runtime alias：React/jsx-runtime、react-dom、Radix dialog/slot、Lucide、CVA/clsx/tailwind-merge 使用 JSON 中真实 JS 入口；不能用 .d.ts 代替。通过现 Vitest/Vite TSX transform 载入真实 Picker，`test.css: false` 只让 Node direct 环境忽略样式（无假 helper），CSS 不在 Node direct 声称已验。配置在 own/tmp，CSS transform/alias 静态独审后方运行；不使用裸 tsx 绕开 .css 解析。
4. 浏览器复用现 start/check fixture 的实际 HTTP catalog 路径及全套 runtime aliases，真实 CSS/Tailwind 在 browser 加载。当前六组场景：键盘单次Apply+A/B/C；空筛选/分页/能力；same-tuple新稿/props-lag CAS/view/unmount；focus/390双主题；空页/40配置目录32组合/legacy；已应用后页配置在刷新首页缺选时保 C/A/B/text，实际 after20 HTTP 加载后仅 exact profile21 可选并明确一次 Apply。仍无生产 App、Send/Queue、Recovery 或 provider。

建议未来分别申请一次30s noEmit/direct（含5s cleanup，tmp8MiB/raw2MiB）和一次60s browser（含15s cleanup，tmp64MiB/retained8MiB）；这是提案，不是授予预算/运行窗口。复用已有外部监督方法，新 task 的 source/claim/HEAD/实际预算必须独立绑定；旧 gate/耗时/37与4 PASS不得继承。Chrome native sibling 边界需当前精确接受，不能自动沿旧批准启动。

源码新增 helper 在原 Picker 文件，未新增路径。当前 clean-code 静态 diffcheck 0，不等于 types/direct/browser PASS。
