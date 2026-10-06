# 成熟聊天主题扩展与自然呈现：固定研究及待验收项

记录时间：2026-10-06 09:37:01 UTC。来源为/root已完成的固定源码只读研究及官方资料阅读；本管理仅把它绑定既有稳定TODO，不修改已审VISUAL产品，不安装依赖，不把静态推断当browser复现。

## MATURE01-01：单一材质token合同

固定be50d36f4bb7fcebc70887881cdca0237ff0d55f（最终a8仅CSS分栏与专测窄修，与下列接缝无关）：plugins/validation.ts约46/142只接受color名称名单及字符串正则，ThemeDefinition.tokens是泛Record；styled Thread目前由styles.css约648–649 descendant!important硬设thread-max-width/composer-radius。根主题材料变量不能覆盖这些局部硬值。VISUAL四builtin主题证明宿主内建切换/不透明回退；它不证明外部主题可扩圆角/阴影/blur。

后继设计约束：采用一个typed token catalogue定义名称、数值或枚举域、默认值和CSS映射；保持既有颜色兼容，材质只写已知变量。组件消费var(--flow-..., fallback)，避免局部硬覆盖。阴影等级、圆角、透明度和blur有有限值域，不把任意字符串或CSS.supports('--任意变量', value)当验证，因为自定义属性通常接受任意token串。具体终端CSS属性可做浏览器支持补验；@property可声明类型/继承/default，但不替代普通fallback和host校验。

## MATURE01-02：主题生命周期及实际消费者

root静态核themes.initialTheme()只认builtin ID；main.tsx启动applyTheme(initialTheme())会将保存的未在builtin表插件ID覆盖成系统fallback，App也只themes.find。当前reload实测只覆盖四builtin；Ocean现场切换/disable回退不等于插件主题跨reload保留。**这是实际源码接缝推断，尚无专门browser复现，非本次已审slice的新增失败。**

后继沿同一theme lifecycle保存待解析插件ID/安全scheme，等已授权声明到齐再恢复；禁用、缺失、连接变化有明确fallback，不依赖即时注册顺序、不在首屏盲apply外部CSS。切换/禁用清掉旧theme tokens。验收真实外部主题改变control/pane/composer半径与shell材质、禁用回退、已安装/禁用/缺失插件三种reload；reduced transparency/forced colors优先，popover层级与390排版不回归，不额外读history/task正文。

官方primary资料（root已实际阅读，本管理未重复访问）：[MDN @property](https://developer.mozilla.org/en-US/docs/Web/CSS/@property)、[MDN CSS.supports](https://developer.mozilla.org/en-US/docs/Web/API/CSS/supports_static)、[CSS Variables规范](https://drafts.csswg.org/css-variables/)。这些支撑设计限制，不证明Flow已经实现上述扩展。

## MATURE06-03：默认面向用户的状态语言

GO总体验收约束：默认正文、简短自然状态及需要行动；可识别tool标题，stream轻状态。native ID、字节/来源计数、Provider observations分页、原因和协议诊断统一Details按需。系统通知与模型回复来源分明，不用模板冒充回复、不调用模型润色系统文案。error/unknown/取消未确认及恢复操作保持可见或一步可达；queue/steer受理与实际生效不能混同，不能为简洁把input-ready称running或把unknown称success。

稳定验收四旅程：普通hi、正常stream/tool、queue等待、断线unknown；1280与390、双pane不长期被工程说明占据。原始诊断仍可下钻，不改数据库事实/公共合同。ACTIVITYREAD01仅覆盖已展开native活动区域及其Details，仍保lazy0→1→cache、错误与刷新；queue/stream/外层footer与react默认语言属于后继，当前子片不能关闭整个MATURE06-03。MATURE01负责呈现层一致性，业务事实仍来自现projection。
