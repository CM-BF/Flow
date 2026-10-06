# 验证与实际来源

- [first-red.log](first-red.log)：作者新测试脚本多一个右括号，未运行浏览器；修正脚本，不算产品红测。
- [behavior-red](behavior-red.json) / [log](behavior-red.log)：旧renderer，真实1280x720首次fit断言失败，宽度比应适配画布多327px。
- [first-green](first-green.json) / [log](first-green.log)：产品首次fit/手动resize/五视图/tab已过；测试在已建立native interval后安装虚拟时钟，未推进旧interval，自动refresh计数失败。将clock安装移到页面脚本前；不是产品刷新失败，原报告保留。
- [second-green](second-green.json) / [log](second-green.log)：Chrome实际五组全部通过，pageErrors=[]；自动20秒进度刷新确实新增fixture请求且manual值不变。Node24对两mjs/js语法检查退出0。没有重复跑D0613源事实检查，因为本片未改数据/源定位。

五组涵盖：直接hash首次正宽适配；手动Enter放大与Space缩小/resize/五视图返回/手动及自动snapshot刷新/当前节点保留；Fit恢复自适应；初始progress隐藏宽0后进入与整页reload；390x844五视图局部scroll/42%下限/无整页横溢、节点键盘、light/dark/reduced-motion。

截图：[1280浅色](desktop-light.png)、[1280深色](desktop-dark.png)、[390浅色](narrow-light.png)、[390深色](narrow-dark.png)。作者实际目视1280浅色与390深色。图像是full-page，1280x720视口下可纵向滚动；390截图在键盘访问后，允许保留局部横向scroll，不冒充initial scroll截图。

两实现SHA256与报告/当前/固定target一致，[binding](source-binding.json)。未改CSS/data/index/app/registry/deps，旧D05/D06三件套不写；0用户页面刷新、0真实模型/产品DB、0 live4320请求。未测性能延迟/用户端真实服务。
