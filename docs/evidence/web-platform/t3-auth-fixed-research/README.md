# 固定认证/连接研究（root归因）

Root只读T3 `9bd1d8009a6b7c50f9dd9458e2bf27d481ff3b43`，MIT / T3 Tools Inc.；六份公共source路径与SHA在[原始audit](source-audit.json)。管理只归档audit与结论，未复制整套实现、未运行外部代码/登录/个人服务。

可应用方法：每中心唯一transport owner；HTTP授权与流生命周期分开；session epoch拒迟到；缓存新鲜度与连接状态分开；re-auth不重投mutation。真实浏览器必须验证cookie接受后session read、SSE及reload，而不是只看POST200/authenticated=true。

T3 issue7756为closed duplicate/旧nightly报告，只作失败场景，不是当前T3或Flow复现；不采用JS可读cookie workaround。Root核[RFC6265§8.5](https://www.rfc-editor.org/rfc/rfc6265#section-8.5)及[MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)：cookie不隔离端口，CORS credentials与exactOrigin/CSRF需由中心接口owner明确，不能只改cookie名或centerId冒隔离。现候选有限期可撤销HttpOnly中心session不是已选实施；CLI/runner Bearer保持独立，invalid Bearer不得cookie回退提权。

原MATURE06-04下一旅程，非新大task；认证与发送恢复独立Module/Interface，中心权威/公开客户端复用。正式scope、当前session入口与续期撤销/现有流停止语义要有合法writer及真实定向验证，不能让已建立SSE的存活冒持续已认证。
