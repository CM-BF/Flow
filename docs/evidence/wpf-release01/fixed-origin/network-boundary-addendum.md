# 已审设计的执行边界补充

真实Chrome page.evaluate 内 relative fetch 或实际 page navigation/response 才能消费Chrome手动代理。禁止 page.request、context.request、route.fetch 和 Node fetch 访问固定61228；它们是独立Node APIRequestContext，Chrome argv并不会为其设置代理。本候选不引入第二网络client。旧设计包原字节不改。
