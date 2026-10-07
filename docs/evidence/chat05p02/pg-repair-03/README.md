# PG02后的定向修复与第三段准备

固定source `c98c68b02fcdcff3b9bb7295c1fcda6bb79d28f0`，生产reader/runtime/store保持1bb已审字节。原PG01/PG02各0/2与UNKNOWN_RETAIN保留，独立CONFIRMED资源清理单列；本次不重放已消费namespace。

第一项锁流异常来自production.test自己的原始fetch响应收尾：成功读取response.json()后又无条件cancel。产品reader尚未在该位置调用。本次只对未消费body执行cancel，保留状态和legacy内容断言。新增纯例直接提取真实helper，以原生内存Response覆盖已消费200、不读403、错误500、错误200正文四分支；未发HTTP/PG。

第二项实际首因是activity_session。32个请求内，fixture将任务/注册/注入adapter标为fixture，而既有store要求Claude会话。修正测试为一致的真实Claude身份，仍显式注入原无provider adapter，不加载默认adapter、不调用SDK模型；不放宽store或runner身份校验。fixture错误元信息字段改名为replyStatusBeforeErrorHandler，明确此前200是错误处理前状态，不能当线上的HTTP结果。

local-run-07：新增1不同纯例及受影响focused types均exit0，2755ms/raw594B；两组absent、双EOF、两个scratch正常移除。原41+此前2个纯例不重跑；当前44不同局部例分轮通过，types分轮6次，累计22179ms/raw9565B。仅末次文件采样，不声称瞬时磁盘峰值。

入口复用原pg-entry/run.py，只加精确repair-03参数选择新inputs/config/pg-run-03。286实际输入（216源/32SQL及既有依赖/入口）和21aliases保持已审闭包，只有fixture/test/caller及report config四项更新，详见inputs.deltaFromPriorInputs。新专库仍自动factory/033/routes，原两个用例和断言不变；原256请求/90s正常含cleanup+.5TERM+2reap、16MiBtmp/2MiBraw/96MiBPG/live1GiB不变。fresh至少1,287,651,328B，并叠加实际更高并发；新namespace必须不存在。

执行条件：独审固定输入、明确实际共享PG交接、fresh原claim/source/资源。执行入口为`FLOW_CHAT05P02_PG_WINDOW=authorized PYTHONDONTWRITEBYTECODE=1 <固定Python3.13> docs/evidence/chat05p02/pg-entry/run.py repair-03`。本包只准备，PG03 NOT_RUN；任何unknown保持原证据，不额外FORCE清理或自动重试。
