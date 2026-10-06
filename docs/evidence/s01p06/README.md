# S01P06 有界等待交付

四个runner源码/测试与局部类型配置；待固定实现commit及独审。职责见 [Interface](interface.md)，实际检查见 [checks](checks.json)，方法/自审见 [quality](quality.md)。

旧wait等价表达式在2个pending×32tick得到[32,32]，有意义red1项；不是整个旧runtime或内存测量。新真实Module同输入[1,1]，每wait一个timer/listener且结束释放。新真实loopback补槽兼容旧行为，两者均通过。最终72distinct由9 Module +20capacity +10shutdown +33runner组成；完整batch之后仅新refill测试类型身份字段修正，1项定向重过，其他71源码不变。初始strict2与最后strict0、所有原raw保留。4PG未选/0provider/0capacity运行。

setup只复用声明依赖链接，无安装/私有alias/共享目录修改。resource统计仅此WT不跟随symlink文件分配，非整个卷净增长。源码固定后只允许metadata补审，main与分支事实分开。
