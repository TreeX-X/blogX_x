# ljj.world 设计系统提取

> 提取自 <https://ljj.world/>（独立开发者 `lij768423-svg` 个人作品集）。
> 目标：还原其色调、设计风格与首屏加载动画的实现细节，作为可复用的设计参考。
>
> 提取日期：2026-07-28（初版色调/首屏）；2026-07-29 增补「服务器 /systems」爆炸结构图实现。
> 提取方式：抓取站点 HTML / CSS bundle / JS bundle 反向分析。
> 2026-07-29 资产版本：`index-CxWSZOJl.css`、`index-Dp1W-T0E.js`、懒加载 `ServerExplodedStory-C2fHLBPv.js`。

---

## 0. 技术栈速览

- **框架**：React SPA，Vite 构建（`index-*.js` module script + `index-*.css`）。
- **渲染**：客户端渲染，`<div id="root"></div>` 挂载点。
- **字体方案**：本地 `@font-face`（Geist / Manrope / Geist Mono Variable，含 CJK fallback Noto Sans CJK SC）。
- **SEO**：完整 OG / `theme-color` / JSON-LD `Person` schema。
- **CDN**：Cloudflare（`/cdn-cgi/challenge-platform`）。

---

## 1. 色调 (Color System)

整站是一套 **暖纸 (light) / 暖近黑 (dark)** 双主题系统，搭配单一 **珊瑚红/陶土色 accent**。

**核心特征**：
- 所有中性色都带暖偏色（黄绿微调），**从不使用纯灰**。
- 除 accent 外整体低饱和。
- `--radius: 0` —— **全直角**，工程图纸气质。
- 1px 细线分区优先于阴影/圆角卡片。

### 1.1 Light theme（暖纸）

| Token | 值 | 角色 |
|---|---|---|
| `--bg` | `#f3f4f1` / `#f2f1eb` | 暖白纸背景 |
| `--text` | `#121210` / `#151613` | 暖近黑正文 |
| `--surface` | `#e8e7e0` / `#e9eae6` | 卡片表面 |
| `--surface-raised` | `#faf9f4` / `#f8f9f6` | 抬升层 |
| `--surface-deep` | `#d8d7cf` | 凹陷层 |
| `--muted` | `#625f56` / `#696b64` | 次要文字 |
| `--muted-strong` | `#383a35` / `#3a3a36` | 次要强调 |
| `--line` | `#12121029`（16% 黑） | 1px 分隔线 |
| `--line-strong` | `#1212106b` | 强分隔线 |
| `--accent` | **`#f06449`** | 珊瑚红 / 陶土色（主品牌色） |
| `--accent-hover` | `#fbfaf5` | hover 反白 |
| `--accent-ink` | `#171815` | accent 上的文字 |
| `--shadow` | `#00000038` / `#1212101f` | 暖灰投影 |
| `--shadow-strong` | `#0000006b` / `#12121038` | 强投影 |

### 1.2 Dark theme（暖近黑）

| Token | 值 | 角色 |
|---|---|---|
| `--bg` | `#171815` / `#121210` / `#141412` | 暖近黑背景 |
| `--text` | `#f0f1ed` / `#f2f1eb` / `#f6f5ef` | 暖白正文 |
| `--surface` | `#1c1c19` / `#1d1d1a` / `#20211e` | 卡片表面 |
| `--surface-raised` | `#242622` / `#252520` | 抬升层 |
| `--surface-deep` | `#30302a` / `#30322d` | 凹陷层 |
| `--muted` | `#a5a79f` / `#aaa89d` | 次要文字 |
| `--muted-strong` | `#d3d5ce` / `#d6d4ca` | 次要强调 |
| `--line` | `#f0f1ed29` | 暖白 16% 分隔线 |
| `--line-strong` | `#f0f1ed6b` / `#f2f1eb70` | 强分隔线 |
| `--accent` | **`#f06449`** | 同珊瑚红 |
| `--accent-hover` | `#ff7a60` | hover 亮珊瑚 |
| `--accent-ink` | `#f7f7f2` / `#f8f9f6` | accent 上的文字 |
| `--accent-soft` | `#4b2922` | 深陶土（accent 容器底） |
| `--shadow` | `#0003` / `#15161314` | 投影 |
| `--shadow-strong` | `#00000085` / `#1516132e` | 强投影 |

### 1.3 分场景 accent 变体

不同 section / scene 使用不同 accent 主题，但都保持同一套中性底色：

| 变体 | `--accent` | `--accent-hover` | `--accent-soft` | 用途 |
|---|---|---|---|---|
| 默认珊瑚 | `#f06449` | `#fbfaf5` / `#ff7a60` | `#4b2922` / `#f3d8d0` | 全站主品牌 |
| 蓝图蓝 | `#1d39f5` | `#1028d6` | `#1d2b70` / `#dfe4ff` | 技术 / blueprint 场景 |
| 深红 | `#b93b28` | `#9f2f1f` | `#4b2922` | 重音 / 暗场景 |
| Flowing 冷调 | bg `#100e15`, text `#f7f6f8`, line `#f7f6f833` | hover bg `#f7f7f5` | — | flowing 冷暗段落 |

### 1.4 动态光标尾迹（kinetic trail）

| Token | 值 |
|---|---|
| `--kinetic-spotlight` | `#f064493d`（珊瑚 24%） / `#b93b2833` |
| `--kinetic-trail-color` | `#f3b9ac` / `#e5b7af` |
| `--kinetic-trail-filter` | `grayscale(.76) saturate(.72) contrast(1.12)`（light）/ `grayscale(.64) saturate(.62) contrast(1.08)`（dark） |
| `--kinetic-dot-color` | `#f0f1ed21` / `#15161326` |

---

## 2. 设计风格 (Design Style)

### 2.1 定位

- **类型**：独立开发者个人作品集。
- **作者**：`lij768423-svg | 独立开发者`。
- **Tagline**：「把产品做出来，也把它们运行起来。」
- **内容板块**：介绍 (intro) → 关于 (about) → 项目 (projects)，含服务器主机、AI 客户端、开发者工具、自托管基础设施等案例。

### 2.2 字体

| 用途 | 字体栈 |
|---|---|
| UI / 正文 | `Geist Variable`, `Noto Sans CJK SC`, `Noto Sans SC`, `PingFang SC`, `Microsoft YaHei`, `system-ui`, `sans-serif` |
| Display | `Manrope Variable`, `Geist Variable`, `Noto Sans CJK SC`, `sans-serif` |
| 等宽 | `Geist Mono Variable`, `SFMono-Regular`, `Consolas`, `monospace` |

- **字号**：`rem` 单位，偏小精致（常见 `.6rem – .8rem`），editorial / 技术手册式节奏。
- 全部为 **Variable Font**，权重连续可变。

### 2.3 形态语言

| 维度 | 取值 | 含义 |
|---|---|---|
| `--radius` | `0` | **全直角**，工程图纸气质 |
| 分区 | 1px `solid var(--line)` | 细线分区 > 圆角卡片 |
| 抬升 | `--surface-raised` / `--shadow` | 轻量暖灰投影，克制 |
| 投影 | `#00000038` 级 | 低强度、暖偏 |

### 2.4 视觉语言：工程蓝图美学

整站由 **动态技术插画** 构成，CSS keyframe 命名揭示了意象：

- `server-*`：机箱扫描 (`chassis-flow`, `component-scan`, `disc-spin`, `fan-spin`)、信号流 (`signal-flow`, `trace-flow`)、轨道 (`orbit-flow`)、节点脉冲 (`node-pulse`, `marker-pulse`)、线路绘制 (`line-draw`, `line-family-enter`)
- `hero-signal-*`：信号流 / 脉冲 / 旋转 (`flow`, `pulse`, `rotate`)
- `about-signal-*` / `about-trace-*`：信号漂移、扫描、节点心跳、贴纸呼吸 (`sticker-breathe`)
- `about-frame-scan` / `about-panel-scan`：框/面板扫描线
- `project-orbit-*` / `project-fly-*`：项目卡轨道飞入
- `scene-line-*`：场景线条呼吸 / 行进 (`breathe`, `travel-x`, `travel-y`)
- `screenshot-scan`：截图扫描
- `title-orbit`：标题轨道

### 2.5 动效缓动

| 缓动 | 用途 |
|---|---|
| `cubic-bezier(.16, 1, .3, 1)` | 主缓动（expo-out），入场绘制 |
| `cubic-bezier(.32, 0, .16, 1)` | 主题 wipe / 边缘 |
| `cubic-bezier(.48, 0, .22, 1)` | wipe-out |
| `cubic-bezier(.22, 1, .36, 1)` | copy 入场 |
| `cubic-bezier(.4, 0, .2, 1)` | mark 脉冲 |
| `linear infinite` | 持续循环（信号流、轨道、扫描） |

**风格特征**：精确、机械、无回弹（无 `back` / `elastic`），呼应工程仪器质感。

### 2.6 交互细节

- **动态光标尾迹**：spotlight 跟随鼠标 + trail 残影，带 `grayscale + saturate + contrast` 滤镜。
- **主题切换过渡**：`desk-theme-wipe-in/out` + `desk-theme-edge-in/out`，一道 wipe 横扫屏幕切换明暗。
  - `--desk-chrome-duration: 1.24s`
  - `--desk-chrome-ease: cubic-bezier(.32, 0, .16, 1)`
  - `--desk-wipe-x-from: ±100%`

---

## 3. 首屏加载实现 (Page Load / Intro)

### 3.1 机制

React SPA 挂载时，通过 `createPortal(... , document.body)` 注入一个 **全屏覆盖层** `div.home-entry-intro`（`aria-hidden: true`），执行约 **3.55s 的「蓝图启动」动画序列**，在 `home-entry-surface` 的 `onAnimationEnd` 回调中调用 `i()` 将覆盖层从 DOM 卸载，露出真实可交互首页。

### 3.2 启动序列时序

| # | 阶段 | 时间 | 动画名 | 效果 |
|---|---|---|---|---|
| 1 | 网格线绘制 | `0.36s + index·18ms` 起，`1s` | `home-entry-line-draw` | 全屏 1px 暖白网格线 (`#f7f7f233`) 从 `scaleY/X(0)` 逐条生长绘制；纵横交错、正反双向、错峰 stagger |
| 2 | 蓝图框架绘制 | `0.62s – 1.7s` | `home-entry-blueprint-draw` | `clip-path: inset(...) → inset(0)`，从左/右 wipe 出页面线框：header、brand-frame、nav 占位条、tools 占位块、portrait-frame、title-frames、copy / meta 框、signal |
| 3 | 品牌标记脉冲 | `0 – 1.85s` | `home-entry-mark` | "ljj.world" 文字 `scale(.965) → 1` 淡入，保持，末尾 `scale(1.012)` 淡出 |
| 4 | 蓝图退色 | `3.55s` | `home-entry-blueprint-tone` | 线框颜色 `#f7f7f2ad` → `--home-entry-blueprint-destination`，opacity `1 → .28 → 0` |
| 5 | 网格退色 | `3.55s` | `home-entry-grid-tone` | 网格线颜色 → `--home-entry-line-destination`，opacity `→ 0` |
| 6 | 表面揭示 | `3.55s` | `home-entry-surface` | 真实页面 surface 保持并显现 |
| 7 | 黑场消散 | `3.55s` | `home-entry-black-out` | 一层黑遮罩 opacity `1 → 0`，整体由蓝图溶解为真实首页 |
| 8 | 卸载 | `onAnimationEnd` | JS `i()` | 移除 portal 覆盖层，交互就绪 |

### 3.3 keyframe 定义（摘录）

```css
@keyframes home-entry-line-draw {
  0%   { opacity: 0 }
  12%  { opacity: 1 }
  to   { opacity: 1; transform: scale(1) }
}

@keyframes home-entry-mark {
  0%        { opacity: 0; transform: scale(.965) }
  38%, 68%  { opacity: 1; transform: scale(1) }
  87%, to   { opacity: 0; transform: scale(1.012) }
}

@keyframes home-entry-grid-tone {
  0%, 58% { color: #f7f7f233; opacity: 1 }
  78%     { color: var(--home-entry-line-destination); opacity: 1 }
  to      { color: var(--home-entry-line-destination); opacity: 0 }
}

@keyframes home-entry-blueprint-tone {
  0%, 58% { color: #f7f7f2ad; opacity: 1 }
  68%     { color: var(--home-entry-blueprint-destination); opacity: .28 }
  72%, to { color: var(--home-entry-blueprint-destination); opacity: 0 }
}

@keyframes home-entry-blueprint-draw { to { clip-path: inset(0) } }
@keyframes home-entry-frame-draw     { to { clip-path: inset(0) } }
@keyframes home-entry-surface        { 0%, to { opacity: 1 } }
@keyframes home-entry-black-out      { 0%, 58% { opacity: 1 } /* → 0 */ }
```

### 3.4 实现要点

- **覆盖层**：`position: fixed; inset: 0; aria-hidden: true`，通过 `createPortal(..., document.body)` 挂到 body 末尾，`z-index` 高于内容。
- **蓝图 = 页面线框投影**：`home-entry-blueprint` 内部用纯 `<i>` 占位块 + `border: 1px solid currentColor` 拼出 header / nav / portrait / title / copy 骨架——视觉上像建筑师先画蓝图再"建成"真实页面。
- **网格 stagger 公式**（来自 JS）：
  ```js
  c = (e, t) => ({
    "--home-entry-line-index": e,
    "--home-entry-line-delay": `${360 + (e * 7 + t) % 13 * 18}ms`
  })
  ```
  每条线独立延迟，随机感强。
- **主题切换过渡**：`desk-theme-wipe-in/out`（`1.24s`, `cubic-bezier(.32,0,.16,1)`, `--desk-wipe-x-from: ±100%`）+ `desk-theme-edge-in/out`（`0.92s`, `cubic-bezier(.48,0,.22,1)`, `0.1s` delay）——切换明暗主题时一道 wipe 横扫屏幕。

### 3.5 关键 CSS 类

```
.home-entry-intro              覆盖层容器（portal 注入）
.home-entry-surface            真实页面 surface（onAnimationEnd 卸载触发器）
.home-entry-black-out          黑场遮罩
.home-entry-grid-line          网格线（.is-vertical / .is-horizontal / .is-reverse）
.home-entry-blueprint          蓝图线框容器
  .home-entry-blueprint-header
  .home-entry-blueprint-brand-frame
  .home-entry-blueprint-nav
  .home-entry-blueprint-tools
  .home-entry-blueprint-hero
  .home-entry-blueprint-portrait-frame
  .home-entry-blueprint-copy
  .home-entry-blueprint-meta-frame
  .home-entry-blueprint-title-frames
  .home-entry-blueprint-signal
.home-entry-mark               "ljj.world" 标记
```

---

## 4. 「服务器」设计实现（`/systems` · 重点）

> 导航文案：**服务器 / Server**；路由：**`/systems`**；页面标题意象：**「我的服务器 | home-serve」**。
> 这是整站最能代表「工程蓝图美学」的交互章节——不是静态插画，而是 **可聚焦、可爆炸、可下钻服务节点** 的主机结构叙事界面。

### 4.1 产品定位与信息架构

| 维度 | 取值 |
|---|---|
| 路由 | `/systems`（`route-main.is-systems-route`） |
| Kicker | `HOME-SERVE / PERSONAL INFRASTRUCTURE` |
| 主标题 | 我的服务器 |
| 副文案 | 「一台自己组装、自己维护，也真正承载项目与生活的 Linux 主机。」 |
| 快照 facts | 主机 `home-serve` · 运行容器 `70` · 内存 `59 GiB` · NVMe `3.6 TB` |
| 设计意图 | 把 **硬件拓扑 + 自托管服务目录 + 部署关系** 做成可浏览的「结构图」，而不是 README 列表 |

**五层结构章节（bottom nav / category id）**：

| id | shortLabel | 中文 | 叙事职责 |
|---|---|---|---|
| `network` | NETWORK | 网络与入口 | 公开入口 / 私有接入 / 反代 / 探测 |
| `hardware` | HARDWARE | 硬件与算力 | CPU / GPU / 存储 / 传感器 |
| `agent` | AGENT | Agent 与 AI | 模型网关、代理任务、生成工作流 |
| `data` | DATA | 个人数据 | 照片 / 文档 / 对象存储 / 同步 |
| `containers` | CONTAINERS | 容器与日常工具 | Homepage、密码库、PDF、Docker 底座 |

每个 category 下挂 **services[]**（约 25 个节点），服务字段统一为：

```ts
{
  id, name, kind,          // 如 Tailscale / 私有接入
  description,             // 一句话价值
  connection,              // 连接关系（A → B）
  deployment,              // 部署记录（Compose / systemd / 绑定地址）
  entryLabel               // 入口策略：仅 Tailnet / 本机 / 公开项目…
}
```

> 内容模型在主包 `index-*.js` 中定义为 `Ah`（categories）+ `kh`（facts）；视觉与交互在懒加载 chunk **`ServerExplodedStory`**。

### 4.2 技术实现总览（关键结论）

| 层 | 实现 | 说明 |
|---|---|---|
| 路由页 | React Router `/systems` | 桌面：`ServerExplodedStory`；移动：`server-mobile-story` |
| 代码分割 | `React.lazy(() => import('./ServerExplodedStory-*.js'))` | Suspense fallback：`server-three-loading`（历史命名，见下） |
| 主机视觉 | **纯 SVG** `viewBox="0 0 1000 640"` | class `server-machine`，**不是** 当前线上 3D/GLTF |
| 动效 | **Framer Motion**（`animate` / `transition` spring + layout） | 相机平移缩放、面板入场、连接线生长 |
| 线稿资产 | `/assets/server-parts/*-line.png` | 五张部件线稿，用于 focus / service 页 |
| 菜单入口图 | `/assets/flowing-menu/server.webp` | FlowingMenu 导航卡片 |

**关于 `server-three-*` CSS：**  
样式表仍保留 `server-three-stage / canvas / hotspots / meter / vignette` 等规则，加载占位也叫 `server-three-loading`，但 **现行 `ServerExplodedStory` chunk 内无 WebGL / Three / GLTF 引用**。可判断为 **早期 3D 方案残留或备用皮肤**；**当前交付态是 SVG 爆炸结构图 + 2D UI chrome**。项目页的 `ProjectHelix` 才是 WebGL 重模块，与服务器页分离。

### 4.3 视觉结构：`server-machine` SVG 分层

```
.server-story[.is-visual-only]
  └── .server-story-stage          ← 蓝图网格背景 + 左右羽化遮罩
        ├── .server-story-heading  ← 标题 + facts（非 visualOnly）
        ├── .server-story-visual
        │     └── .server-machine-camera   ← Framer 控制的「相机」层
        │           └── svg.server-machine
        │                 ├── defs: grid pattern / vent pattern / drop-shadow
        │                 ├── machine-load-backdrop（网格面、轨道 orbit）
        │                 ├── .server-machine-shell     开架机箱
        │                 ├── .server-machine-board     主板
        │                 ├── .server-machine-cpu
        │                 ├── .server-machine-ram
        │                 ├── .server-machine-nic
        │                 ├── .server-machine-gpu
        │                 ├── .server-machine-storage
        │                 ├── .server-machine-fans
        │                 └── .machine-module-hotspots  可点击热区
        ├── focus / overview / service-page 文案层
        ├── .server-story-panel（右侧详情，非 visualOnly）
        └── .server-story-nav（五章节底栏）
```

**机内部件标签（SVG `<text>`，工程铭牌语气）**：

| 区域 | 铭牌文案 |
|---|---|
| 机箱 | `OPEN FRAME / HOME-SERVE` |
| 主板 | `ATX MAINBOARD / LINUX` |
| CPU | `RYZEN 9` / `9950X` |
| 内存 | `4 x DDR5 / 59 GiB` |
| 网卡 | `2.5 GbE / I226-V` |
| GPU | `RTX 5060 Ti / LOCAL AI` |
| 存储 | `3.6 TB NVMe ARRAY` |
| 风扇/容器 | `AIRFLOW / 70 CONTAINERS` |

**热区（hotspot）→ category 映射**（点击/键盘 Enter·Space）：

| 热区 aria | 指向 id | 标签 |
|---|---|---|
| 聚焦网络与入口模块 | `network` | NETWORK / 网络 |
| 聚焦 CPU 与内存模块 | `hardware` | CPU + RAM / 硬件 |
| 聚焦 NVMe 数据模块 | `data` | NVMe / 数据 |
| 聚焦 GPU 与 AI 模块 | `agent` | GPU / AI |
| 聚焦 Docker 容器模块 | `containers` | DOCKER / 容器 |

热区绘制语言：

- `machine-module-hit`：透明 hit rect（`pointer-events: all`）
- `machine-module-leader`：accent 混色虚线引线（`stroke-dasharray: 3 4`）
- `machine-module-marker`：空心圆锚点
- `machine-module-action` + `machine-module-label`：小铭牌按钮

### 4.4 交互状态机（核心体验）

页面用 DOM dataset 驱动视觉（CSS 大量依赖 attribute selector）：

| 属性 | 值 | 含义 |
|---|---|---|
| `data-story-exploded` | `false` / `true` | 总览 ⇄ 爆炸/聚焦 |
| `data-story-stage` | `network\|hardware\|agent\|data\|containers` | 当前章节 |
| `data-story-overview-entry` | `initial` / `return` | 首次进入 vs 从聚焦返回 |
| class `is-visual-only` | 有/无 | 桌面沉浸模式（隐藏部分 chrome，放大相机） |

**三层浏览深度：**

```
[Overview]
  整机线稿 + 五章节底栏 +（可选）overview 文案/facts
        │ 点击 hotspot / 底栏 category
        ▼
[Focus / Exploded]
  相机 spring 平移缩放对准部件
  该 part 高亮 is-active + accent 描边 + component-scan
  线稿大图 + 放射连接线 + 周边 service 模块卡（01/02…↗）
        │ 点击某个 service
        ▼
[Service Page]
  全屏 service 详情：线稿图 + 名称/描述
  + dl：连接关系 / 部署记录 / 项目入口
  「← 返回 {category}」
```

- 点击 stage 空白（不在 part / 文案 / button 上）→ 若在 service 则退回 focus；若在 focus 则收起 exploded 回 overview。
- `prefers-reduced-motion`：所有 duration 置 0。

### 4.5 「相机」系统（伪 3D，实为 2D transform）

`.server-machine-camera` 由 Framer Motion `animate: { x, y, scale }` 驱动，**每章节一组预设机位**：

**visualOnly（桌面沉浸）机位 `d`：**

| stage | x | y | scale |
|---|---|---|---|
| network | 346 | -266 | 1.4 |
| hardware | -72 | 200 | 1.05 |
| agent | -384 | -315 | 1.45 |
| data | -666 | 387 | 1.5 |
| containers | -22 | -505 | 1.35 |
| 未爆炸 | 0 | 0 | 1.08 |

**非 visualOnly 机位 `f`（更克制）：** network `120,-62,1.34` · hardware `0,0,1.08` · agent `-95,-24,1.27` · data `-180,68,1.31` · containers `0,0,1.02`；未爆炸 scale `0.82`。

**Spring 参数：**

| 场景 | stiffness | damping | mass |
|---|---|---|---|
| 进入聚焦 | 128 | 24 | 0.78 |
| 返回 overview | 168 | 22 | 0.7 |
| 模块卡弹出 | 320 | 25 | — |
| （另一处列表） | 430 | 24 | — |

风格：**机械、略带质量感的 spring**，无回弹夸张；与全站 `cubic-bezier(.16,1,.3,1)` expo-out 并列使用。

### 4.6 入场与循环动效（CSS keyframes）

| 动画名 | 作用 | 要点 |
|---|---|---|
| `server-line-draw` | 机箱/主板/走线描边绘制 | `stroke-dashoffset: 1600→0`，`1.05s` expo-out |
| `server-line-family-enter` | 线族整体 wipe 进入 | `clip-path: inset(0 100% 0 0) → inset(-8%)` |
| `server-chassis-flow` | 机箱轮廓流光 | dashoffset 循环 -43px |
| `server-signal-flow` / `server-trace-flow` / `server-label-flow` | 信号/走线/标签流 | 不同 dash 周期 |
| `server-orbit-flow` | 背景轨道 | dashoffset -256px |
| `server-disc-spin` / `server-fan-spin` | 碟片/风扇旋转 | `rotate(360deg)` linear infinite |
| `server-board-scan` | 主板扫描线纵向扫过 | translateY 0→238px + 透明度脉冲 |
| `server-component-scan` | 聚焦部件 fill 呼吸 | fill-opacity `.62 ↔ 1` |
| `server-node-pulse` / `server-marker-pulse` | 节点/锚点脉冲 | opacity / scale |
| `server-real-float` | 实物图层轻微悬浮 | translateY ±7px + 微旋转 |
| `server-overview-controls-return` | 底栏控件返回淡入 | opacity 0→1 |

**错峰 delay（overview 初次绘制）示例：**

| 部件 | animation-delay |
|---|---|
| shell | ~0.14s |
| board | ~0.30s |
| cpu | ~0.47s |
| ram | ~0.55s |
| nic | ~0.63s |
| gpu | ~0.71s |
| storage | ~0.79s |
| fans | ~0.87s |

→ 视觉上像 **示波器/CAD 按层点亮**。

**实物照片揭示（`machine-real-image`）：**  
默认 `opacity:0; clip-path:inset(0 50%)`；当 `data-story-exploded=true` 且 stage 命中对应 part 时 → `opacity:1; clip-path:inset(0); scale(1)`，带 `contrast(1.06)` 与暖阴影——**线稿与真实硬件在同一坐标对齐切换**。

### 4.7 UI Chrome 与排版语言

| 元素 | 设计语言 |
|---|---|
| Stage 背景 | 双轴细线 grid（`var(--line-strong)` 低透明）+ 左右 `--bg` 羽化，避免插画贴边 |
| 底栏 nav | 5 列 grid、顶 1px 强分隔、active 时 **inset 2px accent 顶条** |
| 模块卡 | **切角 clip-path 六边形感矩形**（缺角 9px），accent 淡描边，mono 序号 `01` |
| 连接线 SVG | `server-story-service-connectors` viewBox 0–100；折线分段 stagger 生长 + 端点小圆 |
| 线稿大图 | 居中、`contrast(1.05)` + 大 drop-shadow，宽 `min(45vw,680px)` |
| 字体 | 标题 Display（Manrope/Geist）；facts / index / kicker → **Geist Mono** |
| 圆角 | 全站 `--radius:0`；模块卡用 **clip-path 切角** 代替圆角，更「钣金/铭牌」 |
| 色彩 | 中性暖底 + 聚焦时 `color-mix(... var(--accent) ...)` 高亮，从不引入第二品牌色 |

### 4.8 桌面 `visualOnly` vs 移动端

| | Desktop `visualOnly` | Mobile `server-mobile-story` |
|---|---|---|
| 主视觉 | 全视口 SVG 爆炸图 | 章节线稿 PNG + 文案 |
| 导航 | 热区 + 底栏 5 tab | 横向 category buttons |
| 服务列表 | 放射模块卡 / 右侧 panel | 编号列表 + 下方 detail article |
| 动效 | 相机 spring + 大量 CSS 循环 | Framer 轻量 opacity/y/scale |
| 隐藏策略 | CSS：小屏 `server-mobile-story` 显示、桌面沉浸隐藏 three-loading 等 | — |

Mobile 线稿映射 `th`：

| category | asset |
|---|---|
| network | `/assets/server-parts/nic-line.png` |
| hardware | `cpu-line.png` |
| agent | `gpu-line.png` |
| data | `nvme-line.png` |
| containers | `container-line.png` |

### 4.9 设计风格总结（服务器专章）

1. **叙事单位是「结构」不是「截图墙」**  
   先给可交互的主机解剖图，再下钻到服务与部署关系。

2. **CAD / 开架服务器混合美学**  
   开架机箱线稿 + 铭牌等宽字 + 虚线引线 + 扫描/风扇/信号流；像维修手册，又像实时机柜 HUD。

3. **伪三维相机，真二维实现**  
   用 spring 驱动的 x/y/scale「机位」代替 3D 轨道相机——性能友好、风格统一、可精确设计每个章节构图。

4. **状态全部可 CSS 选择**  
   `data-story-*` + `is-active` 让高亮、显隐、扫描动画几乎纯 CSS，JS 只改状态与相机。

5. **内容 schema 工程化**  
   category → services → connection/deployment/entryLabel，UI 是 schema 的投影；换数据即可换「另一台主机」。

6. **线稿资产可替换**  
   五张 `*-line.png` 在 focus/service 层承担「图标级英雄图」，与 SVG 结构图分工：结构负责空间关系，线稿负责部件特写。

### 4.10 关键类名速查

```
路由 / 壳
  route-main.is-systems-route
  server-three-loading          (Suspense fallback，历史命名)

桌面故事
  server-story[.is-visual-only]
  server-story-stage
  server-story-heading / -facts
  server-story-visual
  server-story-overview-copy / -heading / -facts
  server-story-focus-copy / -heading / -visual
  server-story-module-list / -index / -copy / -arrow
  server-story-service-connectors
  server-story-service-page / -back / -image / -copy / -details
  server-story-panel / -panel-heading / -category-copy / -services
  server-story-nav
  topology-category / topology-satellite

主机 SVG
  server-machine-camera
  server-machine
  server-machine-part
    server-machine-shell | -board | -cpu | -ram | -nic | -gpu | -storage | -fans
  machine-load-group / -shell / -board / -component / -backdrop / -hotspot
  machine-grid-surface / machine-orbit / machine-axis
  machine-flow / machine-trace / machine-scan-line / machine-panel-flow
  machine-fan-rotor / -blade / -hub / -bezel / -deck
  machine-real-layer / machine-real-image
  machine-module-hotspot / -hit / -leader / -marker / -action / -label / -accent

移动
  server-mobile-story / -shell / -header / -kicker / -facts
  server-mobile-categories / -category / -visual / -category-copy
  server-mobile-services / -service-detail / -service-index …
```

### 4.11 若要「做类似功能」的实现配方（抽象）

> 不绑定「服务器」题材——同一套可迁移到 **工作流演示台 / Agent 舰队 / 开发平台拓扑**。

1. **一页一结构图**：中心是可交互 system diagram（SVG 优先；必要时再上 3D）。
2. **三层深度**：Overview（全貌）→ Focus（子系统）→ Detail（单节点 runbook）。
3. **统一节点 schema**：`id / name / kind / description / connection / deployment / entry`。
4. **相机预设表**：每个 focus id → `{x,y,scale}`，spring 过渡。
5. **dataset 驱动皮肤**：exploded / stage / entry 全部进 DOM attribute，CSS 负责高亮与循环动效。
6. **描边绘制入场 + 持续 signal/fan 循环**：静态图会「死」，循环 micro-motion 会「在跑」。
7. **切角卡片 + mono 序号 + 1px 线**：延续工程蓝图 UI，避免圆角 SaaS 卡片。
8. **桌面沉浸 / 移动降级**：桌面保留空间叙事；移动改为线稿 + 列表，不硬搬相机。

---

## 5. 一句话总结

> 整站是「**暖纸 + 珊瑚红 `#f06449` + 全直角 `--radius:0` + Geist Variable 字体**」的 **工程蓝图美学**；首屏加载是一段 **3.55 秒的蓝图启动动画**——1px 网格线逐条绘制 → 页面线框骨架 `clip-path` wipe 成形 → "ljj.world" 标记脉冲 → 蓝图退色 + 黑场消散，最终溶解为真实可交互首页。  
> 其中 **`/systems` 服务器页** 把同一语言推到极致：以 **SVG 开架主机爆炸图 + Framer 伪相机 + 五层服务 schema** 做成可下钻的个人基础设施叙事（HOME-SERVE），而非截图陈列。

---

## 6. 可复用清单（若要落地到本项目）

### 6.1 全站基础

- [ ] 色板：暖中性 + 单珊瑚 accent，全 token 化（`--bg / --text / --surface / --line / --accent`）
- [ ] 字体：Geist Variable + Noto Sans CJK SC，Geist Mono Variable 等宽
- [ ] `--radius: 0` 全直角
- [ ] 1px 细线分区语言
- [ ] 蓝图启动 intro：portal 覆盖层 + 网格绘制 + 蓝图 wipe + 标记脉冲 + 黑场消散
- [ ] 主题 wipe 过渡
- [ ] 动态光标 trail / spotlight
- [ ] 工程意象 keyframe 库（signal / orbit / scan / spin）

### 6.2 服务器式「结构叙事」页（优先可抄）

- [ ] 路由级沉浸壳（`is-systems-route` 类：禁多余滚动、全视口 stage）
- [ ] 中心 SVG system diagram + part 分层（shell/board/cpu/… 可替换为 workflow 节点）
- [ ] Hotspot：hit 区 + 虚线 leader + marker + 铭牌 label
- [ ] 状态机：`exploded` + `stage` + `overview-entry` dataset
- [ ] 伪相机：每 stage 的 `{x,y,scale}` spring 机位表
- [ ] 三层 UI：Overview / Focus（连接线+模块卡）/ Detail（connection·deployment·entry）
- [ ] 节点 schema 驱动（categories → services）
- [ ] 线稿英雄图资产（每子系统一张 `*-line`）
- [ ] 入场 `stroke-dashoffset` 错峰绘制 + 循环 fan/signal
- [ ] 切角 clip-path 模块卡 + mono 序号
- [ ] 移动端降级：线稿 + category/service 列表（不做伪相机）
- [ ] `prefers-reduced-motion` 全链路 duration=0

---

## 7. 后续灵感备忘（未实现）

> 用户意向：参考上述服务器结构叙事，扩展一个 **个人工作流演示界面**，候选对象包括 Claude Code、Codex、个人开发平台 JanusX 等。当前仅记录方向，不进入实现。

| 可迁移的 ljj 模式 | 映射到工作流演示 |
|---|---|
| 开架主机 SVG | Agent / 工具链 / 平台拓扑总图 |
| 五 chapters（network…） | 例如：路由 · 编排 · 编码 · 评审 · 记忆/技能 |
| service 节点 | 具体 skill、子 agent、MCP、流水线步骤 |
| connection / deployment | 数据流、触发条件、运行环境 |
| 伪相机聚焦 | 点选某工作流子系统时推近对应集群 |
| 线稿特写 | 每个工具的「蓝图图标」而非营销截图 |
| facts 条 | 当前会话数 / 技能数 / 并行 agent 等快照 |

**设计约束建议（延续 ljj 风格）：** 暖纸底 + 单 accent、全直角/切角、mono 元数据、结构图优先于仪表盘卡片墙；先讲清「系统怎么接在一起」，再展示「某一个在跑什么」。