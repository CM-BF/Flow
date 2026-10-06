# WPF-ATTACHI01 review

**状态：NOT_STARTED**

Review target commit：4c4de124b24a85b9e2a13e097b29c80b1e84d11a

Base：8701a6cf547248e70aa5758f05da1d7d314ae9c0

独立入口为9个实现/测试文件，见[固定source manifest](../../docs/evidence/wpf-attach-i01/source-manifest.json)。作者17局部tests、Web typecheck和10官方Thread浏览器组通过，0 page errors；[运行说明与限制](../../docs/evidence/wpf-attach-i01/README.md)。尚未独立review，不继承任何旧feature审批。

重点：host绑定/权限不是IDs授权；不可变capture与原key/未知回执；15s timeout释放槽；complete附件绕过adapter仍统一验证；React portal表单事件/官方composer拥有ID清理；正文按需/有限cache；newdraft与late结果隔离；protected tab关闭不同于dispose。typed内存ports，不包含实际公共HTTP/Send/Queue/App/真实center或provider。
