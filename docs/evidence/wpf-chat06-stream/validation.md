# 验证

固定实现 `3ac11cba14ce8baac3b3a769c19827f6343ca4a7`。最终运行实际来源为 `ed187d6ef99e0d4ba1479ebce42f27714ff219c7` + 五个未提交实现/测试文件，绝不倒填为之后的提交。2026-10-06T07:25:25.130882Z 记录 [checks.json](checks.json)，逐文件 SHA256 与固定 target 一致，见 [source-binding.json](source-binding.json)。

作者最终直接检查 54/54（累计器/消息32，投影22），07:25:20Z，Vitest4.0.18，1.20s：[final-direct.log](final-direct.log)。同段 Web tsc exit0：[final-typecheck.log](final-typecheck.log)。没有新增生产依赖，frozen/offline安装来源见 [install.log](install.log)；本树 workspace client/contracts，不借用旧中心 client。

覆盖：非连续runner sequence、合法sourceMessageId变化、UTF8/8KiB/1MiB与块/patch预算、空terminal、不可变重放、身份/修订/字节偏移/digest、页原子失败；metadata分页与新块竞态、late crypto/hidden/offline/dispose、单flight/4页让出/3次错误预算、超时可见、无请求能力边界；final先到/patch未齐、retained历史、unavailable不猜、跨attempt不混正文、same-ID旧digest不覆盖新final。typed final与Task运行状态分离；投影只读metadata/patch，绝不自动full-block/detail。

公开 FlowClient 验证使用 mock fetch；其余实际模块通过 bound mock ports 验证，未启动HTTP server，不冒称真实中心联调。未运行browser/build/DB/model；无App UI或provider流式验收。root独立审查的运行与结论另见 [review](../../../plans/wpf-chat06-stream/review.md)。

失败与修复历史保留原日志：

- [first-typecheck.log](first-typecheck.log)：object辅助函数的TypeScript Record返回类型不符，已改为显式Object.fromEntries，后续tsc通过。
- [first-direct.log](first-direct.log) 26通过 → [second-direct.log](second-direct.log) 43通过；均为较早moving版本。
- [integrity-red.log](integrity-red.log)：3个实际产品红测——同修订metadata与digest不符、同ID迟到canonical覆盖最新内容、旧attempt final混入新草稿。随后 [integrity-green.log](integrity-green.log) 47通过；后续 [boundary-direct.log](boundary-direct.log) 52通过。
- [final-seam-red.log](final-seam-red.log)：2失败/52通过，canonical无显式status及部分合法页错误重置重试预算。修复后 [direct.log](direct.log) 54通过；又补metadata已标interrupted/host仍running的同例断言，最终54与tsc如上。

实现五文件 `git diff --check` 为0。原始日志含Vitest/tsc产生的尾空格或尾空行，保留原始格式；完整含raw日志的diffcheck可能非0，不能称全范围通过。纯文档及源码检查另排除 `*.log`，不清洗原证据。
