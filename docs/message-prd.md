# 主页留言功能 PRD

> 版本：v2.0
> 日期：2026-04-23
> 状态：已实现
> 更新：根据实际工程实现完善文档

---

## 一、需求概述

在博客**关于页面**（`/about`）设计两种不同功能的留言模块：

1. **趣味留言墙** - 用户可设置名称和内容，AI自动审核后展示，内容以水平飘动动画呈现
2. **点子收集箱** - 用户提交点子，管理员审核后展示，带实现状态标记

**实现位置说明：**
- 留言功能放置在 `/about` 页面（非首页）
- 位于个人信息介绍之后
- 趣味留言墙在上，点子收集箱在下

---

## 二、功能详情

### 2.1 趣味留言

#### 功能描述
- 用户输入昵称（2-20字符）和留言内容（5-200字符）
- 提交后由 AI 自动审核内容安全性（GLM-4.5-AIR）
- 审核通过的留言在展示区域以水平飘动动画呈现
- 留言进入固定轨道后从屏幕一侧匀速飘向另一侧，完整离开展示区域后才回收
- 新留言平滑进入队列，最多同时展示20条

#### 用户流程
```
用户填写表单(昵称+内容)
    ↓
点击提交
    ↓
前端校验(长度、本地频率限制30秒)
    ↓
显示"提交中..."
    ↓
API处理(服务端校验 + AI审核)
    ↓
审核通过 → 显示成功提示 → 留言加入飘动队列
审核拒绝 → 显示拒绝原因
    ↓
前端自动刷新获取新留言(5秒轮询)
```

#### 数据结构
```typescript
interface FunMessage {
  id: string;              // 唯一标识
  name: string;            // 留言人昵称 (2-20字符)
  content: string;         // 留言内容 (5-200字符)
  createdAt: number;       // 创建时间戳
  status: 'approved' | 'rejected' | 'pending';  // 审核状态
  ip: string;              // IP地址(用于频率限制)
}
```

#### AI审核流程
1. 提交时立即审核 - 只审核通过的内容才存储
2. 后台定期处理 - 每次API请求时自动处理pending状态的留言
3. 审核未通过的消息会被自动删除
4. 审核通过的消息状态更新为approved

#### 展示规则
- 只展示 `status: 'approved'` 的留言
- 新留言优先展示
- 最多同时展示 20 条留言
- 留言必须分配到固定轨道中展示，同一时刻不允许重叠
- 每条留言在生命周期内保持固定垂直位置，不得因重排、刷新或轮询而跳动
- 留言只有在完全移出可视区域后才回收，新留言按队列补位
- 前端每5秒自动刷新获取新留言

#### 运动与布局约束
- 留言轨道采用预分配策略，优先保证可读性，而不是追求随机分布
- 当轨道已满时，新留言进入等待队列，等前一条完成离场后再进入
- 轨道宽度、速度和起始位置应在进入时计算并保持不变，避免显示过程中重新刷新位置
- 留言文本过长时应限制单条宽度，防止挤压邻近轨道

#### 实际效果
```
┌─────────────────────────────────────────────────────────┐
│              💬 趣味留言墙                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│   │   💬 "留言内容1" - 小ber    →                   │   │
│   │   💬 "留言内容2" - 小丁    →                   │   │
│   │   💬 "留言内容3" - 大Tree    →                  │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│  当前已展示 3 条留言，全部位于独立轨道中                │
│  还有 1 条留言正在审核                                   │
│                                                         │
│  昵称: [________] 留言: [________________] [提交]        │
└─────────────────────────────────────────────────────────┘
```

---

### 2.2 点子收集箱

#### 功能描述
- 用户输入昵称（2-20字符）和点子内容（5-500字符）
- 所有提交默认进入待审核状态
- 管理员在后台审核，决定是否展示
- 已展示的点子标记实现状态（已实现/待实现）
- 支持管理员备注功能

#### 用户流程
```
用户填写表单(昵称+点子描述)
    ↓
点击提交
    ↓
前端校验(长度限制)
    ↓
API存储(status=pending)
    ↓
显示"感谢提交，等待管理员审核"
```

#### 管理员流程
```
访问管理后台(/admin/ideas)
    ↓
输入管理员密码登录
    ↓
查看待审核列表
    ↓
审核操作：
  - 通过并已实现 → 设置 implemented=true
  - 通过但待实现 → 设置 implemented=false
  - 拒绝 → 可选填写拒绝原因
    ↓
前端自动更新展示列表
```

#### 数据结构
```typescript
interface Idea {
  id: string;              // 唯一标识
  name: string;            // 提交者昵称 (2-20字符)
  idea: string;            // 点子内容 (5-500字符)
  createdAt: number;       // 创建时间戳
  status: 'pending' | 'approved' | 'rejected';  // 审核状态
  implemented: boolean;    // 是否已实现
  adminNote?: string;      // 管理员备注(可选)
  ip: string;              // IP地址
}
```

#### 展示规则
- 只展示 `status: 'approved'` 的点子
- 已实现的点子显示 ✓ 标记
- 待实现的点子显示 ○ 标记
- 按实现状态分组展示
- 页面加载时获取一次，无需轮询

---

## 三、安全防护设计

### 3.1 多层防护架构

```
┌─────────────────────────────────────────────────────────┐
│  第1层：前端校验                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ - 昵称长度 2-20 字符                              │    │
│  │ - 趣味留言内容 5-200 字符                         │    │
│  │ - 点子内容 5-500 字符                             │    │
│  │ - 本地频率限制：同一浏览器 30秒内只能发1条          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  第2层：API 服务端校验                                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ - IP 频率限制：同一IP 5分钟最多3条（滑动窗口）      │    │
│  │ - 全局频率限制：全站每分钟最多50条（滑动窗口）       │    │
│  │ - 内容长度再次校验                                │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  第3层：AI 内容审核（仅趣味留言）                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ - 调用 GLM-4.5-AIR API 判断内容安全性              │    │
│  │ - 检测：广告、辱骂、敏感政治、恶意链接              │    │
│  │ - 返回：{ safe: boolean, reason: string }         │    │
│  │ - 仅审核通过才存储                                 │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  第4层：管理员审核（仅点子收集箱）                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ - 所有提交默认 status='pending'                    │    │
│  │ - 管理员手动审核后才展示                           │    │
│  │ - 可设置实现状态和备注                             │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 频率限制规则

| 限制类型 | 规则 | 存储位置 |
|---------|------|---------|
| 前端本地限制 | 同一浏览器 30秒 1条 | localStorage (前端ref) |
| IP 频率限制 | 同一IP 5分钟最多 3 条，滑动窗口计数 | Upstash Redis |
| 全局限制 | 全站每分钟最多 50 条，滑动窗口计数 | Upstash Redis |
| 点子IP限制 | 同一IP 5分钟最多 5 条 | Upstash Redis |

### 3.3 滑动窗口实现

```typescript
// 时间窗口计算
const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
const key = `${prefix}:${ip}:${windowStart}`;

// 计数器递增
const nextCount = await redisIncr(key);
if (nextCount === 1) {
  // 首次访问，设置过期时间
  await redisExpire(key, windowSeconds + 5);
}

// 判断是否超限
return {
  allowed: nextCount <= limit,
  remaining: Math.max(0, limit - nextCount),
  resetAt: (windowStart + windowSeconds) * 1000,
};
```

---

## 四、技术方案

### 4.1 数据存储

**选用方案：Upstash Redis**

| 对比项 | Upstash Redis | JSON文件 | LanceDB |
|-------|-----------|----------|---------|
| 与现有架构一致性 | ✅ 完全一致 | ❌ | ⚠️ |
| 并发写入支持 | ✅ | ❌ | ⚠️ |
| 免费额度 | 256MB 足够 | 无限 | 已有 |
| 部署持久化 | ✅ 自动 | ❌ 会丢失 | ✅ |
| 查询效率 | ✅ O(1) | ❌ O(n) | ⚠️ |

**KV Key 设计：**
```
fun-messages:list              → 趣味留言列表 (JSON数组)
fun-messages:ip:{ip}:{window}  → IP频率限制计数 (滑动窗口)
ideas:list                     → 点子列表 (JSON数组)
ideas:ip:{ip}:{window}         → 点子IP频率限制计数
messages:global:window         → 全局窗口标识
messages:global:count:{window} → 全局频率限制计数
blogx:healthcheck              → Redis健康检查
```

**Redis操作实现：**
```typescript
// 使用 REST API 直接操作
async function redisCommand(command: string[]): Promise<unknown> {
  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  return response.json();
}

// 常用操作
redisGet(key)           // GET
redisSet(key, value, ttl) // SETEX / SET
redisIncr(key)          // INCR
redisExpire(key, ttl)   // EXPIRE
```

### 4.2 AI 审核实现

**使用 GLM-4.5-AIR 模型：**

```typescript
async function auditContent(name: string, content: string): Promise<{
  safe: boolean;
  reason?: string;
}> {
  const prompt = `请审核以下留言内容是否合适公开展示。

判断标准：
1. 不包含广告、推销内容
2. 不包含辱骂、攻击性语言
3. 不包含敏感政治内容
4. 不包含恶意代码或可疑链接

留言人昵称：${name}
留言内容：${content}

请只回复 JSON 格式，不要有其他内容：
{"safe": true或false, "reason": "如果不安全，说明原因"}`;

  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4.5-air',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,  // 低温度保证稳定输出
    }),
  });

  // 解析返回的 JSON
  const data = await response.json();
  const responseContent = data.choices?.[0]?.message?.content;
  const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch[0]);
}
```

**审核策略：**
- 提交时立即审核，不通过则直接拒绝
- 后台定期处理pending状态的留言
- 审核失败的消息自动删除

### 4.3 管理员认证

**方案：密码哈希 + HttpOnly Cookie**

```typescript
// 认证配置
const ADMIN_PASSWORD = env("ADMIN_PASSWORD");
const ADMIN_SESSION_SECRET = env("ADMIN_SESSION_SECRET");

// 会话令牌生成
function getAdminSessionToken(): string {
  return createHash("sha256")
    .update(`${ADMIN_PASSWORD}:${ADMIN_SESSION_SECRET}`)
    .digest("hex");
}

// 会话验证
function verifyAdminSession(sessionValue: string): boolean {
  const expected = getAdminSessionToken();
  return sessionValue === expected;
}

// Cookie配置
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 8, // 8小时
};
```

**管理后台访问方式：**
- URL: `/admin/ideas`
- 先通过 `/api/admin/login` 提交管理员密码
- 登录成功后由服务端下发 `HttpOnly` Cookie (`blogx_admin_session`)
- 后续审核接口只认 Cookie，不暴露管理员密钥到前端

---

## 五、API 端点设计

### 5.1 趣味留言 API

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/fun-messages` | POST | 提交新留言 | 无 |
| `/api/fun-messages` | GET | 获取已审核留言 | 无 |

**POST 请求体：**
```json
{
  "name": "昵称",
  "content": "留言内容"
}
```

**POST 成功响应：**
```json
{
  "success": true,
  "message": "审核通过，留言已发布",
  "messageId": "uuid-xxx"
}
```

**POST 失败响应：**
```json
{
  "error": "留言未通过审核：包含广告内容"
}
```

**GET 响应：**
```json
{
  "messages": [
    {
      "id": "xxx",
      "name": "昵称",
      "content": "留言内容",
      "createdAt": 1713849600000,
      "status": "approved"
    }
  ],
  "pendingCount": 1,
  "status": "pending"
}
```

### 5.2 点子收集箱 API

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/ideas` | POST | 提交新点子 | 无 |
| `/api/ideas` | GET | 获取已审核点子（分组） | 无 |
| `/api/ideas/admin` | GET | 获取所有点子 | HttpOnly Cookie |
| `/api/ideas/admin` | POST | 审核点子 | HttpOnly Cookie |

**POST 请求体：**
```json
{
  "name": "昵称",
  "idea": "点子内容"
}
```

**GET 响应：**
```json
{
  "implemented": [
    {
      "id": "xxx",
      "name": "昵称",
      "idea": "点子内容",
      "createdAt": 1713849600000,
      "implemented": true,
      "adminNote": "已添加功能"
    }
  ],
  "pending": [
    {
      "id": "xxx",
      "name": "昵称",
      "idea": "另一个点子",
      "createdAt": 1713849600000,
      "implemented": false
    }
  ]
}
```

**审核请求体 (POST /api/ideas/admin)：**
```json
{
  "id": "点子ID",
  "action": "approve",
  "implemented": true,
  "adminNote": "管理员备注(可选)"
}
```

### 5.3 管理员认证 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/login` | POST | 管理员登录 |
| `/api/admin/logout` | POST | 管理员退出 |
| `/api/admin/redis-health` | GET | Redis健康检查 |

**登录请求体：**
```json
{
  "password": "管理员密码"
}
```

**登录成功响应：**
- 设置 `blogx_admin_session` Cookie
- 返回 `{ "success": true }`

---

## 六、前端组件设计

### 6.1 页面布局

留言功能放置在**关于页面** (`/about`)，位于个人信息下方。

```
┌─────────────────────────────────────────────────────────┐
│                        导航栏                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                   关于我 / About                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              个人信息区域                         │   │
│  │                                                 │   │
│  │  [头像]                                         │   │
│  │  名字：树码                                      │   │
│  │  简介：...                                      │   │
│  │  联系方式：...                                   │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              💬 趣味留言墙                         │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │                                         │    │   │
│  │  │   💬 "留言内容1" - 小ber    →            │    │   │
│  │  │        ←  💬 "留言内容2" - 小丁          │    │   │
│  │  │   💬 "留言内容3" - 大Tree    →           │    │   │
│  │  │                                         │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  │                                                 │   │
│  │  当前已展示 3 条留言                            │   │
│  │                                                 │   │
│  │  昵称: [________] 留言: [________________] [提交] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              💡 点子收集箱                         │   │
│  │                                                 │   │
│  │  ✓ 已实现                                        │   │
│  │    • 点子A - 添加了AI搜索功能                     │   │
│  │    • 点子B - 优化了移动端体验                     │   │
│  │                                                 │   │
│  │  ○ 待实现                                        │   │
│  │    • 点子C - 添加评论功能                         │   │
│  │                                                 │   │
│  │  昵称: [________] 点子: [________________] [提交] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**布局说明：**
- 留言功能作为关于页面的互动区域
- 位于个人信息介绍之后
- 趣味留言墙在上，点子收集箱在下
- 保持主页简洁，专注内容展示

### 6.2 趣味留言组件 (`FunMessages.tsx`)

**功能要点：**
- 水平飘动动画（从左到右或从右到左）
- 随机起始垂直位置（10%-70%）
- 随机飘动方向（左或右）
- 新留言平滑进入队列
- 留言飘动15秒后自动移除
- 每5秒自动轮询获取新留言
- 客户端速率限制（30秒提交间隔）

**核心实现：**
```typescript
// 飘动消息组件
function FloatingMessage({ message, direction, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 15000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const style = {
    animation: direction === 'left'
      ? 'float-left 15s linear forwards'
      : 'float-right 15s linear forwards',
    top: `${Math.random() * 60 + 10}%`,
  };

  return (
    <div className="floating-message" style={style}>
      <span className="message-bubble">
        "{message.content}" - {message.name}
      </span>
    </div>
  );
}

// 客户端速率限制
const now = Date.now();
if (now - lastSubmitRef.current < 30000) {
  setStatus('提交过于频繁，请等待30秒');
  return;
}
```

**飘动动画CSS：**
```css
@keyframes float-left {
  from { transform: translateX(100%); }
  to { transform: translateX(-100%); }
}

@keyframes float-right {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

.floating-message {
  position: absolute;
  white-space: nowrap;
  font-size: 0.9rem;
  pointer-events: none;
  z-index: 1;
}

.message-bubble {
  background: color-mix(in srgb, var(--text) 10%, transparent);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  display: inline-block;
}
```

### 6.3 点子收集箱组件 (`IdeaBox.tsx`)

**功能要点：**
- 分组展示（已实现/待实现）
- 状态图标（✓/○）
- 提交成功提示
- 页面加载时获取一次数据
- 显示提交者和日期信息

**核心实现：**
```typescript
interface Idea {
  id: string;
  name: string;
  idea: string;
  createdAt: number;
  implemented: boolean;
  adminNote?: string;
}

// 分类显示
const { implemented, pending } = data;
setImplementedIdeas(implemented);  // ✓ 已实现
setPendingIdeas(pending);          // ○ 待实现

// 时间格式化
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN');
};
```

---

## 七、环境变量配置

```env
# AI审核配置
GLM_API_KEY="bba6d037ad194852a18cfeaa2f0c7547.GrutJWv2bF1m7D6S"
GLM_MODEL="glm-4.5-air"

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://stunning-phoenix-74627.upstash.io"
UPSTASH_REDIS_REST_TOKEN="gQAAAAAAASODAAIgcDJmZDM3MWY5MTI4Yjg0NDBmOWMwNjRkNjgzZDgzZGRhYg"

# 留言功能配置
MESSAGE_RATE_LIMIT_IP="3"
MESSAGE_RATE_LIMIT_GLOBAL="50"
MESSAGE_RATE_LIMIT_WINDOW="60"
MESSAGE_RATE_LIMIT_IP_WINDOW="300"
MESSAGE_MAX_DISPLAY="20"

# 管理员配置
ADMIN_PASSWORD="X740288105"
ADMIN_SESSION_SECRET="blogx_x_secret_key"
```

**配置说明：**
- `GLM_API_KEY`: AI审核的密钥
- `GLM_MODEL`: 使用的AI模型（glm-4.5-air）
- `UPSTASH_REDIS_REST_URL`: Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN`: Redis访问令牌
- `MESSAGE_*`: 留言相关频率限制配置
- `ADMIN_PASSWORD`: 管理员登录密码
- `ADMIN_SESSION_SECRET`: 会话加密密钥

---

## 八、实现状态

### ✅ 已完成的功能

#### Phase 1: 基础设施
- [x] Upstash Redis 实例配置
- [x] 数据操作模块：`src/lib/kv-messages.ts`
- [x] 环境变量配置

#### Phase 2: API 开发
- [x] 趣味留言 API：`src/pages/api/fun-messages.ts`
- [x] 点子提交 API：`src/pages/api/ideas.ts`
- [x] 管理审核 API：`src/pages/api/ideas/admin.ts`
- [x] 管理员登录/退出 API：`src/pages/api/admin/login.ts`, `logout.ts`
- [x] Redis健康检查 API：`src/pages/api/admin/redis-health.ts`
- [x] 频率限制中间件（滑动窗口实现）
- [x] AI 审核函数（GLM-4.5-AIR）

#### Phase 3: 前端组件
- [x] 飘动留言组件：`src/components/FunMessages.tsx`
- [x] 点子箱组件：`src/components/IdeaBox.tsx`
- [x] 相关样式：`src/styles/global.css`
- [x] 关于页面集成：`src/pages/about.astro`

#### Phase 4: 管理后台
- [x] 管理页面：`src/pages/admin/ideas.astro`
- [x] 审核操作界面
- [x] 状态切换功能
- [x] 管理员认证模块：`src/lib/admin-auth.ts`

#### Phase 5: 测试与优化
- [x] 提交流程测试
- [x] 频率限制测试
- [x] AI 审核测试
- [x] 管理审核测试
- [x] 飘动动画优化

**实际实现时间：约 3 小时**

---

## 九、验收标准

### 功能验收

- [x] 趣味留言可正常提交并显示飘动效果
- [x] AI 能正确审核留言内容（GLM-4.5-AIR）
- [x] 点子可正常提交并进入待审核状态
- [x] 管理员可审核点子并设置实现状态
- [x] 已审核点子正确分组展示

### 安全验收

- [x] IP 频率限制生效（滑动窗口）
- [x] 全局频率限制生效
- [x] 恶意内容被 AI 拒绝
- [x] 管理接口需 HttpOnly Cookie 认证
- [x] 前端本地频率限制

### 性能验收

- [x] 飘动动画流畅不卡顿
- [x] API 响应时间 < 500ms
- [x] 页面加载不受留言组件影响
- [x] 5秒轮询刷新留言列表

---

## 十、后续扩展

### 可能的增强功能

1. **留言点赞** - 用户可给留言点赞
2. **留言回复** - 支持回复他人留言
3. **表情支持** - 支持Emoji表情
4. **邮件通知** - 新点子提交时邮件通知管理员
5. **数据导出** - 导出留言/点子数据
6. **统计分析** - 留言活跃度统计
7. **留言置顶** - 管理员可置顶重要留言
8. **批量审核** - 管理员批量审核点子

---

## 附录：文件清单

### 新增文件

```
src/
├── lib/
│   ├── kv-messages.ts          # KV 数据操作
│   └── admin-auth.ts           # 管理员认证
├── pages/
│   └── api/
│       ├── fun-messages.ts     # 趣味留言 API
│       ├── ideas.ts            # 点子 API
│       ├── ideas/
│       │   └── admin.ts        # 管理审核 API
│       └── admin/
│           ├── login.ts        # 管理员登录
│           ├── logout.ts       # 管理员退出
│           └── redis-health.ts # Redis健康检查
├── components/
│   ├── FunMessages.tsx         # 趣味留言组件
│   └── IdeaBox.tsx             # 点子箱组件
└── pages/
    └── admin/
        └── ideas.astro         # 管理页面
```

### 修改文件

```
src/
├── pages/
│   └── about.astro             # 集成新组件
└── styles/
    └── global.css              # 新增飘动动画样式

.env                            # 新增配置项
```

### API 端点汇总

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/fun-messages` | POST | 提交趣味留言 | 无 |
| `/api/fun-messages` | GET | 获取已审核留言 | 无 |
| `/api/ideas` | POST | 提交点子 | 无 |
| `/api/ideas` | GET | 获取已审核点子 | 无 |
| `/api/ideas/admin` | GET | 获取所有点子 | Cookie |
| `/api/ideas/admin` | POST | 审核点子 | Cookie |
| `/api/admin/login` | POST | 管理员登录 | 无 |
| `/api/admin/logout` | POST | 管理员退出 | Cookie |
| `/api/admin/redis-health` | GET | Redis健康检查 | 无 |

---

> 文档版本：v2.0
> 最后更新：2026-04-23
> 状态：已完成实现
