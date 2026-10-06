# CHAT10 独立审查

状态：NOT_STARTED
- Review target commit：UNKNOWN
- Base commit：32c371d389a913f8dd71c3bd8b98dd0697411256
- Scope：可信配置parser、task-bound只读admission、共享新命令policy与直接行为测试。
- 审查说明：核tree/head/claim/固定source与raw，GET不写/缺schema安全、完整conditions/POST锁内重验和幂等replay；不重审CHAT08整体、不将作者检查当独审。
- 未验证：真实provider/UI、生产CLI共享挂载、个人服务部署。
