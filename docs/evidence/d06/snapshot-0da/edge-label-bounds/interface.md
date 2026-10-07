# D06 连线文字背景修复

固定实现 `a28e8dac9ab3bd56231c13a0b090e986cc69eb0d`，base `cc1f83457f04a02147c854f0503409db1bebb355`。本片沿 D06-11；[原子amend](amend-receipt.json)仅追加 architecture.js，五范围，未新建任务。唯一进度仍为原 D06 status。

首轮实际失败及所有原件留在[原索引](../browser-first-20261007/index.json)。root独立固定diff确认：0da→5124 renderer/CSS及“回复引用”“本地只读”edge定义未变；本轮新几何检查暴露既有14px文字与 `label.length*8+14` 背景估算不符，不是新data回归。

`drawEdge`仍创建同一SVG path、rect、text；不改文本、坐标路由、主题、五图数据或外部Interface。新私有 `fitEdgeLabels()` 在所有边挂载后，先一次批量读 text.getBBox，再批量写对应背景。水平/垂直padding为7/3 SVG单位，最小背景40×19；不靠字符数量或空格调整。

隐藏的初始架构panel不测量；activateTab解除hidden后补测。切换视图在新元素全部挂载后重测。缩放不改变SVG用户坐标系字体边界，原fit/内部横向滚动保持。当前system font与原CSS不改；无新字体、异步测量循环、store或依赖。

## 验证与边界

仅静态diff/精确Git与当前文件hash检查，[source proof](source-proof.json)。原22direct已独审通过，数据/断言未改；本修复依赖实际SVG layout，重复原22不能证明修复，所以未重跑，也不写只镜像实现的假DOM测试。

后继仍用已固定browser中相同文字bbox/背景/canvas断言，保五图×1280/390×双主题、键盘source下钻；不放宽测试。原packet与已消费gate不变，未来必须绑定新renderer/metadata、独立审查及实际窗口。原90s保守用6733，剩83267含15000清理，非第二次许可。当前新Node/Chrome/HTTP/PG均NOT_RUN，未改CSS/server/registry/main/个人服务。
