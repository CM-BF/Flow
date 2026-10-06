# ACTIVITYI-R1 离线读取修复

固定修复：ba341d77672ba8456197d64d54193aee79719e46；原候选：e93070cc08339325cd299105f5805ca871a07ea8。独立复审待root结论，不自动继承任何批准。

root确认P2：ConversationProjection进入disconnected时turns引用不变，adapter仅依turns同步且current只看visible/身份，离线仍激活native读取。原候选完整74/dev11/prod10未覆盖它。

修复把connection=live纳入读口有效性，React effect单独消费connection变化。native/generic失去连接时deactivate；generic同时消费setOnline。已读取cache保留，飞行正文signal取消并丢弃晚到结果；重连只有可见已展开source恢复，隐藏仍零读取。页面显示paused提示和禁用无效正文重试；成功body:null只显示无正文，不提供无效Retry。后者来自root非blocking小项。

## 检查

- [红测](offline-red.log)：原实现新增2case失败、旧5通过，证明缺口，不是只测实现形状。
- [绿测](offline-green.log)：同7case全过；同turns引用disconnect、native/events/body零读、signal取消、迟到结果、hidden重连与cache。
- [固定修复60相关](revision-tests.log)：native9+adapter7+C03generic44通过；P01原16不受影响，复用原e930结果，不称本轮重新执行76。
- [typecheck](revision-typecheck.log)、[build](revision-build.log)通过；chunk警告保留。
- [dev实际App离线](development-offline-browser.json)与[production实际App离线](production-offline-browser.json)各1group通过，按Playwright发起request计数（不仅服务端收到数），断网切源零尝试、inflight迟到不写、overview隐藏重连零活动读、返回后显式retry成功、草稿保留。

两新browser的17文件hash、当前字节、固定ba341全符，见[revision-source-manifest.json](revision-source-manifest.json)。dev执行于27f metadata+修复工作树，随后提交相同源码；prod执行于ba341。原完整browser/raw/screenshots保留e930来源，未伪作本轮全量重跑。

当前保留production预览51454不曾关闭；本树重新build后reload加载修复bundle。0模型/产品DB。真实center/provider、其他浏览器/屏读仍未验证。
