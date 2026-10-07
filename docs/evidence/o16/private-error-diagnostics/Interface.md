# O16 有界私有错误记录

本片属于原 O16-06，claim55c4v1/原三scope。实际R2失败包54bf/d82f已封存，不能回填丢失正文；累计2 SDK、无第三次预算。本实现仅0query合成直接consumer。

`createPrivateErrorRecorder({directory,sourceDigest,phase,secrets}) → record(frame,binding)` 只负责已绑定phase私有目录中的一次exclusive0600错误记录，复用records.writeRecord及原测量/监督。目录realpath/dev/ino/owner/私有mode先固定并在写前后重核。固定query身份形成文件名；已有文件不覆盖/不重试。单记录≤8192B，文本总UTF8≤4096B/错误数组≤16，不增原runtime8MiB/raw2MiB或权限。来源超过原frame262144B拒绝保正文unknown；缺字/非字符串/截断有明确状态。只取result/errors字符串，不复制整个event、环境或配置。既有runner secret及常见token形式脱敏，私有文本仍按敏感材料保留，不承诺识别任意秘密。

query-run保持原唯一iterator及声明门禁。观察器遇SDK错误结果后，在抛出原观察异常前调用记录器并持久公开report；公开只含受控分类、存在性、大小、摘要、截断/约束和持久错误。特别分类success subtype + isError true，不把它都缩为observation-rejected。诊断写失败不替换原观察异常；公开checkpoint失败另存evidenceFailure，既有settleStage保持cleanup独立。无正文不造内容，无重试/新模型权限。worker注入原reportFile目录与持久函数；不新增transport、loop、supervisor或认证代理。

依赖方向：worker负责实际目录/绑定与已知secret → query-run原迭代接缝 → 小诊断模块 → records持久原语。正常成功和早期声明拒绝不调用错误存储。原R2 source/frame/DB/tmp保持不动。

本地技能沿已安装find-skills发现，codebase-design检查单一持久职责和窄接口，clean-code检查异常/生命周期，brainstorming采用Lead已明确有界设计无需重问；不安装。局部检查新7项，仅合成query/私有文件与原settleStage，≤30s累计/8MiB tmp/512KiB raw，0PG/SDK/auth/provider。真实SDK错误正文的形状和实际写入仍未验。

固定SDK结构字段优先：复用query-policy现有投影保存assistant.error（固定枚举）、system/api_retry error/error_status（最多16项，更多显式omitted）、result.api_error_status（reported/null与absent/invalid unknown分开）。固定sdk.d.ts SHA193becad9d69bc4d2ccd22def53fb9bff9e2628e324f7657d9497da9476af541，行3589–3596/3618/3693/5780。无任意error字符串公开，不通过正文模式猜认证、额度或模型原因。公开来源字段是SDK声明；不据其证明账户或网络根因。旧R2未保存这些字段，不能回填。
