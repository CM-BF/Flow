# 原六组：原生可打印字符输入准备

固定source `dde571be8853698f8943f952ddef2c648d2e1294`；只修改原browser.ts。NOT_RUN：当前四select输入语义尚未实际运行，不能将先前m诊断、26direct或旧Settings01结果迁移为本次六组通过。当前源等待root一次窄审。

## 输入合同

四个原生select各只接受一次固定字符 m / 自 / 高 / 标，统一通过当前Chrome CDP Input.dispatchKeyEvent keyDown(text/key/unmodifiedText)及keyUp。真实Tab进入下个select；radio仍ArrowDown/Space、Apply仍Enter。禁止DOM event/value赋值、selectOption备用/交替键重试；原第二组故意制造不匹配的既有selectOption不变，不能冒键盘覆盖。

每项先验自有fixture origin、UTF8、唯一enabled/focused/connected且闭合select、完整3项options/value/text及唯一前缀匹配。沿已有passive observer读取新eventId/精确label；要求有且仅一trusted未prevented keypress→input→change，指定完整值/index1、下一帧仍未prevented。每步都保C omitted/commit0；一帧≤1s仅观察，0sleep/input fallback。

旧observer保持96event/48KiB/8options，四项合计最多96记录，新源报告总≤64KiB；独立CDP session在finally detach并记失败。native-filter-inputs.json始终保部分或完整证据，若前置/输入失败，不补值或继续换键。ASCII/Unicode候选来自exact154源码，不冒已实证中文路径；不是物理键盘/IME/系统popup测试。

## 保持与未来接缝

原A/B/C diagnostic整个函数逐字不变；原首select循环之后六组的所有行为断言逐字保留，唯一首组描述改准确输入术语。原三源逐字=fe6，无Picker改动；A/B/双pane/text/CAS/refresh/分页/390双主题及两PNG仍必需。父/worker/权限/cleanup本段均未改、未造新包。未来原runner需在已审新source绑定中使用新首check名称、新acceptance函数hash，并接收native-filter-inputs.json；旧623f仅历史，不把新test口径伪装旧字节。

## 实际小检查

受影响单browser strict/noUncheckedIndexedAccess noEmit：actual exit0，1274.84816708602ms（20s总含5s清理），单ownedNode1531、EOF/0B输出、group/scratch absent/errors[]。真实当前@flow源码与只读TypeScript5.9.3声明映射；OS deny-network/source-write，ownscratch16MiB/retained1MiB。未跑原26/direct、Chrome、PG、安装、构建或空间采样。[原件](noemit/actual.json)、[4源及依赖依据](source-manifest.json)、[最小diff](source.diff)。浏览器旧30625闭合；新段37627/余52373不变。
