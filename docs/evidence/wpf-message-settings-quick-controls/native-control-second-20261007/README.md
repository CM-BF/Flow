# Native-control 第二轮实际失败

source521a / HEAD753ccd，Chrome154.0.8037.99（.98原件保留），06:32:06.292003–06:32:12.518811 UTC。outeractualexit1 / 唯一FAILEDseal完整匹配。

UTF-8、公开label“模型”、selectCount1/exactLocatorCount1已实测。plain A真实Down/Enter捕获10条事件，焦点保持/无阻止/无input-change/值仍空；快照只有after字段，没有value，随后TypeError阻止B及modal。此为诊断调用错误：Locator.evaluate接字符串时isFunction=false，arrow表达式没有调用；不是Picker失败或旧.98原因已证。

后继仅把同只读snapshot函数作为真正函数传入evaluate，不依赖闭包/helper、不赋值、不增键序、不改原六组/三产品源。B/modal与0/6组/0PNG保持未验。原错误/trace不改。

parent6188/late6189/outer6226.722708088346ms均保留；保守6227，新段累计17449/余72551，旧30625/未用29375闭合。Chrome0、完整EOF/0drop；parent51494/worker53613/Chrome51498与scratch清理，fixture/context均正常关闭。没有第二次消耗本gate；下一轮须fresh同边界来源/carry/输入核验。

root实际独审与a9窄源修正接受原件见root-actual-review.json；无新runtime/types通过。
