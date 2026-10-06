# CHAT06P03 — runner prefix hash

当前实现将每个正文block的已发UTF8计数与SHA256状态保存在Block中，seal只输入新patch文本，copy()后digest。原全文仍用于最终source核对；UTF16 sent、公共patch全部字段、frame/marker顺序与错误/abort行为不变。没有改公共合同、coalescer、SDK adapter或DB。

本次唯一检查绑定准备21b1846abfe2c2ffdf9e32dc075b05188a666972；17:30:46.343–17:30:48.383 UTC，receipt后2040.193ms。预期red1/4未选，green5/5不同tests，strict根全部选项exit0。原stream.test.ts未修改且NOT_SELECTED。具体argv/child/group/stdio、own缓存身份和清理见[check-receipt.json](check-receipt.json)，完整CLI原文见[check-cli.stdout](check-cli.stdout)，[会计](validation-accounting.json)加计预检文件。

所有实际注入帧（red+green、baseline+candidate、delta+完整assistant）累计616486 UTF8 JSON字节/148帧。主样本64KiB正文的完整公开输出逐项相等，实际Hash.update总输入495379→200467 B，实际Buffer.byteLength总输入589824→360448 B；两边含相同frame指纹和ID开销，不能称prefix-only或CPU/SLO测量。其余覆盖Unicode跨patch边界、空phase、重复frame、多block、tool-before-frame、supersedes、late aborted full、signal abort/source error/result前flush。受控16B attempt/8B patch fixture只验证截断语义等价，不证明生产1MiB上限；既有超窗口原测试未选。

3个局部check进程自然结束，group absent、pipe EOF、stdio closed；单个own TMP/cache按原inode统计并删除（1357700 logical B、1359872 allocated B），归档时再次确认该精确path不存在。0 PG/实际SDK/provider/native任务/安装。人工封存发生在检查窗口外，文件字节另计，未声称封存时间属于2.04s。

独立review与main集成待Mika/Lead，不套用前序CHAT06P02批准。
