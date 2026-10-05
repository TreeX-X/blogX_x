---
schema: harness-note/1
id: e405bfad-0886-4ab2-a900-9ebaaa016572
kind: idea
lifecycle: proposed
created: 2026-10-05
class: architecture
---

# 延后事项：私有内容备份仓

## Intent

内容全部落入 LanceDB `content` 表之后，为该表建立一个私有 git 备份仓，`content:backup` 导出全量 markdown 提交进去，`content:restore` 从备份灌回表内。理由与取舍见 [备份决策](2026-10-05-decision-backup-private-repo--c5f9fdea.md)。

## Why deferred

用户判定优先级低于内容迁移本身。`git rm --cached` 执行时，公开仓的 git 历史已保留 `src/content/**` 的冻结快照，因此内容出仓的瞬间并非无副本状态；缺的只是后续新内容的增量备份与版本历史。

## Trigger

满足以下任一条即启动：内容出仓（T2）完成并稳定运行一周以上；`content` 表出现需要按时间点回滚的需求；LanceDB Cloud 出现一次影响数据的故障。

## Open questions

备份频率取每次发布后自动执行，还是按日执行；备份仓是否需要保留草稿态记录；`CONTENT_BACKUP_PAT` 是否与 Vercel env 中的其他 PAT 分离管理。
