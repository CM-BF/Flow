# 首次Cookie HTTP错误诊断实际

固定source fc2916c275efe86203d91ec33656ea9871eac42a / 实际HEAD af5d8077194fbc6e961d891687336478595ade49。只运行新Cookie必要链，不执行旧三App或importReports。

17:02:28.596973Z START，actual outer exit0、唯一DIAGNOSTIC_COMPLETE终态与result/budget/raw哈希匹配。它仅表示捕获过程完整；passed=false、reports=null，正式四App兼容仍未通过。

[被动观察原件](raw/fixture/http-client-errors.json)：1条HPE_CLOSED_CONNECTION，bytesParsed=1，late-logout/reconnect，连接29，端口60741→60655；association UNKNOWN / wireIndex null。56条upstream观察、complete=true、drop0。页面仍记录GET /api/browser-session 400；没有rawPacket、headers/body/token或异常message/stack观测。错误已复现，但连接关联不足，不据阶段或近邻请求认定因果，不把全部400当预期异常。

[完整归还](outer/return-receipt.json)：17:03:55.066182Z核实outer50337/worker50421/Chrome57021各PID与PGID ESRCH；marked DB正常DROP、center/proxy closed、全部inner/outer EOF/drop0、scratch/profile absent、exact admin dev/ino输入删除。ceil(max outer14880.285667, late14823.280, parent/budget)=14881ms；独立90s CLOSED，未用75119ms不转信用或自动重试。父accepted清理与真实raw一致。

[index](index.json)原样封存12runtime原件及输入、外层观察和既有审查；父/worker/sandbox保固定TMP原件并由[精确pins](caller-source-pins.json)引用。没有追加运行、源修改或新正式报告。[Root actual独审](root-actual-review.json)已接受捕获与完整RETURN，非兼容批准；旧c1/c2失败和全部预算不改。

[只读候选对应](observation-summary.json)发现相同60741→60655端口tuple出现两次：wire26为较早stream200，wire34为随后browser-session400；故原唯一匹配规则保UNKNOWN。此处仅列候选，不把端口复用当socket身份/请求解析根因证明。
