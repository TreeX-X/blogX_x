---
{
  "schema": "harness-note/2",
  "id": "6b7bb634-c504-4a92-8ff8-2d09ffbcb2f9",
  "kind": "decision",
  "lifecycle": "accepted",
  "created": "2026-10-17",
  "updated": "2026-10-17T06:12:09Z",
  "module": "note://f6f78001-d086-47ba-b627-787ada391296/4d500b85-a071-45ab-adb0-c1c2ff26790d"
}
---

# 部署与依赖锁文件

站点使用 Astro SSR 与 Vercel adapter。Vercel 当前根据 `pnpm-lock.yaml` 选择 pnpm 10，采用冻结安装；本地与部分脚本仍使用 npm，因此修改依赖时必须同步 `package.json`、`package-lock.json` 和 `pnpm-lock.yaml`。暂不迁移包管理器，也不关闭冻结检查，以避免无关依赖升级。双锁文件有维护成本，若后续统一包管理器，应同时更新开发文档、工作流与 Vercel 配置。

GitHub Actions 的 `dependency-check.yml` 在依赖清单或锁文件变更时运行 pnpm 冻结锁文件检查，不拉取站点内容、不连接数据库。GitHub Pages 已从 `legacy` 分支构建切换到 `workflow` 模式，停止把 Astro 前置脚本作为 Jekyll YAML 解析；此设置不会创建 Pages 发布工作流，SSR 生产站点仍由 Vercel 托管。

故障证据：提交 `c5ef7c3` 的 Vercel 部署 `dpl_AkVkrfsKY4xCF9Jgsa3jyXhNm5GY` 在安装阶段报 `ERR_PNPM_OUTDATED_LOCKFILE`，缺失依赖为 `three@^0.186.1`；GitHub run `39008619835` 则在 Jekyll 解析 `src/pages/server.astro` 时失败。补齐 pnpm 锁文件仅新增 three 的 8 行记录，无其他依赖升级。

推送前验证：独立 checkout 上 `pnpm@10 install --lockfile-only --frozen-lockfile --ignore-scripts --offline` 通过；源码编译及静态路由预渲染通过，本地最终 Vercel 打包受 Windows 符号链接权限限制，未记作完整构建成功。GitHub Pages API 回读确认 `build_type=workflow`。远端结果以新提交的 Vercel 部署与依赖检查为准。
