# SVC08 Interface — 首帧后上游异常结束

有限spike/既有Module直接消费者。固定base a2e78031，其static-web与af51逐字相同；已安装find-skills/codebase-design/clean-code/brainstorming本地方法：先真实对照，再按状态所有权修一次，避免跨层复制代理和监督。

`startStaticWeb`仍拥有Vite静态服务/同源proxy与close；新test在独立child内观察原http.createServer（只转发并记录，不修socket）。小synthetic artifact通过原verify而非build；无发布/版本切换结论。借既有Vite8.3.2只读alias及Node24.20.0，0依赖安装。

最少4请求：上游正常结束、首帧已被client实际读到后FIN截断、同位置RST、最后identity。≤6请求硬上限；最多2服务自有loopback端口，排除61227/61228/4320。各阶段最多300ms等终结，未终结先记录failure与双方getConnections/end/close/destroyed，不用client提前destroy掩盖残留；随后仅清自己的请求和server，再持久cleanup。

旧133次覆盖32未完header RST、32client abort和64活SSE容量校准，228 observed sockets全close，不能扩大为任意连接无泄漏。个人两次64CLOSED只是kernel状态，不等Node计数。本轮反例若成立仅支撑该proxy路径，不能冒个人根因。

单轮≤10s，OPS14 NEW_CHILD_SESSION 7s工作+.5sTERM+1s回收，记录≤64KiB、私有tmp≤1MiB，事件≤256。共用一个run记录，各轮原stdout/stderr保留；累计≤30s/192KiB/3MiB/18请求。fresh1GiB+4MiB与同队合计预算保持。checkpoint早于清理，unknown资源KEEP；不操作历史PID/个人目录。监督复用sharedModule，不新建FSM。

产品改动仅由反例证据触发：修异常流生命周期时保留原proxy匹配/认证透传、ws:false、正常SSE、静态并发和64cap。无反例则原产品保持。

## 实际交付接缝

本次有限反例成立。`startStaticWeb`通过Vite现有`proxy.configure`接收proxy，注册`proxyRes`回调；upstream拥有自己的异常事件，对应downstream由此模块销毁。正常end不进入新分支；没有第二代理/调度器/连接计数权威。调用方签名、关闭接口和依赖方向不变。新事件监听与单个响应同生命周期；不保留全局响应列表，不推断未知结果为成功正文。

修复源086ba13d和原1红→1绿见README。原测试观察包装只用于测试，未进入产品；测试前后恢复http.createServer。个人部署与根因仍开放，不能因为这条路径修复就标整REQ19完成。架构影响是既有static-web内部proxy-response终结责任闭合，公开Interface/中心/runner均无变化。
