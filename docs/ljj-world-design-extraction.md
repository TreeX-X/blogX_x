# ljj.world 设计系统提取

> 提取自 <https://ljj.world/>（独立开发者 `lij768423-svg` 个人作品集）。
> 目标：还原其色调、设计风格与首屏加载动画的实现细节，作为可复用的设计参考。
>
> 提取日期：2026-07-28
> 提取方式：抓取站点 HTML / CSS bundle (`index-DtlE2CUa.css`) / JS bundle (`index-D-4WkOTX.js`) 反向分析。

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

## 4. 一句话总结

> 整站是「**暖纸 + 珊瑚红 `#f06449` + 全直角 `--radius:0` + Geist Variable 字体**」的 **工程蓝图美学**；首屏加载是一段 **3.55 秒的蓝图启动动画**——1px 网格线逐条绘制 → 页面线框骨架 `clip-path` wipe 成形 → "ljj.world" 标记脉冲 → 蓝图退色 + 黑场消散，最终溶解为真实可交互首页，覆盖层随即从 DOM 卸载。

---

## 5. 可复用清单（若要落地到本项目）

- [ ] 色板：暖中性 + 单珊瑚 accent，全 token 化（`--bg / --text / --surface / --line / --accent`）
- [ ] 字体：Geist Variable + Noto Sans CJK SC，Geist Mono Variable 等宽
- [ ] `--radius: 0` 全直角
- [ ] 1px 细线分区语言
- [ ] 蓝图启动 intro：portal 覆盖层 + 网格绘制 + 蓝图 wipe + 标记脉冲 + 黑场消散
- [ ] 主题 wipe 过渡
- [ ] 动态光标 trail / spotlight
- [ ] 工程意象 keyframe 库（signal / orbit / scan / spin）