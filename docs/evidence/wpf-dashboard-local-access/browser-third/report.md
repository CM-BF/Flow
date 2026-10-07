# ACCESS 第三轮准备（NOT_RUN）

固定测试 `ccd88577652369e17385a30c9a9a3dfa8e91d966`；当前metadata `e970f81a3ef71220dbb394f0447b281cacd37b0a` clean。原产品08ec与前四组不变，新增第5组原生hidden前提已获root限定源审。只复用已实际正确收尾的caller，未运行本候选。

预算保守原已耗18728/60000ms，本次最多41272ms（工作26272 + 清理15000）；scratch≤256MiB/raw≤8MiB，均为逻辑计量/监控，非OS硬配额。前两次FAILED和原文件保留。外层实际耗时比父早报告更晚，最终计费取晚终态并保守向上。

入口（仅明确交接后）：`python3 /private/tmp/access01-browser-third-2855hbyp/run.py`。沿旧outer capture方法保存完整terminal.stdout/terminal.stderr及actualexit/outerElapsedMs，先创建本目录唯一scratch/raw。当前未创建这两目录，无gate、无运行权；不得把此README当运行许可。保持native Chrome sandbox，自有profile/CDP/动态HTTP、fake token，0个人服务/真实凭据/PG/provider/用户tab。

原33项来源pin全部复核，仅browser新hash；run/worker最小diff单独保存。Python AST只做静态解析；没有Node/import/测试/Chrome/free/proc采样。页内CDP仅本fixturepage/ownedwindow；它不授权控制任何既有用户浏览器。

当前SVC06交接未完成，我组不占窗。下一次必须root具体handback+fresh组合资源、scope/HEAD/pins一致。metadata后若变化必须显式重绑，不把新的HEAD暗当当前执行源。此准备不新造supervisor，也不扩大旧生命周期。
