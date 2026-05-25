# AI 商务谈判官 (Negotiation Coach) v2.0

> 🎯 拍一张合同照片，AI帮你分析风险、制定策略、模拟对手、审查法律条款

基于小米 MiMo 多模态大模型的智能商务谈判分析系统，**8个 AI Agent 协作**完成全流程谈判分析。

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    用户上传文档/照片/文本                          │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│          MiMo-V2-Omni (多模态视觉理解)                           │
│    📄 文档分析师：识别合同类型、提取条款、发现风险                  │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│          MiMo-V2-Pro (推理引擎) - 核心分析层                     │
│    ⚠️  风险评估师：6维度评估 + 量化评分                           │
│    🎯 策略顾问：BATNA/ZOPA + 多阶段策略                          │
│    🎭 对手模拟官：模拟对方立场 + 预测回应                         │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│          MiMo-V2-Pro (推理引擎) - 扩展分析层                     │
│    ⚖️  法律顾问：中国商法深度审查 + 合规性分析                    │
│    🧠 情绪分析师：PAD情绪模型 + 心理博弈识别                      │
│    📊 市场情报员：PESTEL分析 + 价格基准评估                      │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│    👔 谈判官：综合报告 + 谈判清单 + 语音汇报                     │
│          MiMo-V2.5-TTS (语音合成)                               │
│    🔊 生成2分钟语音谈判简报                                      │
└─────────────────────────────────────────────────────────────────┘
```

## 🤖 8 Agent 协作系统

| # | Agent | 模型 | 职责 | 输出 |
|---|-------|------|------|------|
| 1 | 📄 **文档分析师** | MiMo-V2-Omni | 识别合同类型、提取关键条款 | 结构化文档分析 |
| 2 | ⚠️ **风险评估师** | MiMo-V2-Pro | 6维度风险量化评分 | 风险报告+评分 |
| 3 | 🎯 **策略顾问** | MiMo-V2-Pro | BATNA/ZOPA分析、多阶段策略 | 谈判策略方案 |
| 4 | 🎭 **对手模拟官** | MiMo-V2-Pro | 模拟对方立场、预测回应 | 对手应对方案 |
| 5 | ⚖️ **法律顾问** | MiMo-V2-Pro | 中国商法审查、合规性分析 | 法律审查报告 |
| 6 | 🧠 **情绪分析师** | MiMo-V2-Pro | 情绪识别、心理博弈分析 | 心理分析报告 |
| 7 | 📊 **市场情报员** | MiMo-V2-Pro | 市场数据、竞品分析、价格基准 | 市场情报报告 |
| 8 | 👔 **谈判官** | MiMo-V2-Pro + TTS | 综合报告、语音简报 | 最终报告+语音 |

## ✨ 核心功能

### 1. 📄 智能文档分析 (MiMo-V2-Omni)
- 上传合同/邮件/招标文件图片
- 自动识别文档类型和各方主体
- 提取关键条款（金额、期限、付款条件等）
- 识别隐藏的风险条款

### 2. ⚠️ 六维度风险评估 (MiMo-V2-Pro)
- 法律风险 / 财务风险 / 履约风险
- 合规风险 / 声誉风险 / 战略风险
- 量化评分（0-100）+ 隐蔽风险发现

### 3. 🎯 智能谈判策略 (MiMo-V2-Pro)
- BATNA 分析（最佳替代方案）
- ZOPA 分析（可能协议区间）
- 多阶段策略规划（开局/中场/终局）
- 让步策略和双赢机会识别

### 4. 🎭 对手模拟 (MiMo-V2-Pro)
- 站在对方立场思考
- 模拟可能的回应和反驳
- 预测对方底线和让步空间
- 识别对方谈判陷阱

### 5. ⚖️ 法律条款审查 (MiMo-V2-Pro)
- 引用《民法典》《合同法》等具体法条
- 格式条款合法性审查
- 争议解决机制有效性评估
- 行业特定合规检查

### 6. 🧠 情绪心理分析 (MiMo-V2-Pro)
- PAD情绪模型（愉悦度/唤醒度/主导度）
- 8种心理博弈策略识别
- 语言信号分析（正面/负面/防御/进攻）
- 心理应对策略生成

### 7. 📊 市场情报分析 (MiMo-V2-Pro)
- PESTEL行业分析框架
- 竞争格局评估
- 价格基准和合理区间
- 供应商对比分析

### 8. 🔊 语音汇报 (MiMo-V2.5-TTS)
- 生成2分钟谈判简报
- 支持播放和下载
- 适合快速向领导汇报

## 🏗️ 项目结构

```
ai-negotiation-coach/
├── server.js                    # 主服务器（HTTP路由+中间件集成）
├── package.json                 # 项目配置
├── README.md                    # 项目说明
│
├── config/
│   └── default.js               # 默认配置管理
│
├── lib/
│   ├── mimo-client.js           # MiMo API 客户端
│   ├── orchestrator.js          # 8 Agent 编排器
│   ├── db.js                    # JSON 文件数据库
│   ├── export.js                # 多格式导出
│   │
│   ├── agents/                  # AI Agent 模块
│   │   ├── base.js              # Agent 基类
│   │   ├── document-analyst.js  # 文档分析师
│   │   ├── risk-assessor.js     # 风险评估师
│   │   ├── strategy-advisor.js  # 策略顾问
│   │   ├── counter-party.js     # 对手模拟官
│   │   ├── legal-advisor.js     # 法律顾问 ⭐
│   │   ├── emotion-analyst.js   # 情绪分析师 ⭐
│   │   ├── market-intel.js      # 市场情报员 ⭐
│   │   └── negotiator.js        # 谈判官/主持人
│   │
│   ├── middleware/               # HTTP 中间件
│   │   ├── auth.js              # 认证授权（API Key + JWT）
│   │   ├── rate-limiter.js      # 限流（滑动窗口/令牌桶/漏桶）
│   │   └── logger.js            # 结构化日志
│   │
│   ├── services/                # 业务服务层
│   │   ├── analytics.js         # 数据分析和洞察
│   │   ├── notification.js      # 通知服务（Webhook/控制台）
│   │   └── history.js           # 历史管理（搜索/标签/归档）
│   │
│   └── utils/                   # 工具库
│       ├── validators.js        # 输入验证
│       ├── formatters.js        # 数据格式化
│       └── cache.js             # 内存缓存（LRU）
│
├── data/                        # 数据文件
│   ├── industries.json          # 10个行业数据库（含基准价格）
│   ├── risk-patterns.json       # 风险模式库
│   ├── clause-templates.json    # 条款模板库 ⭐
│   └── negotiation-scripts.json # 谈判话术库 ⭐
│
├── tests/                       # 单元测试
│   ├── agents.test.js           # Agent 测试套件
│   └── utils.test.js            # 工具库测试套件
│
└── static/
    └── index.html               # 前端仪表盘
```

## 🛡️ 中间件系统

### 认证授权 (auth.js)
- **API Key** 认证（`X-API-Key` 头）
- **JWT Token** 认证（`Bearer` 头）
- 登录/登出/会话管理
- 审计日志追踪
- 登录失败锁定

### 请求限流 (rate-limiter.js)
- **滑动窗口**算法（默认）
- **令牌桶**算法（突发流量）
- **漏桶**算法（平滑流量）
- 自定义路由规则
- 限流响应头

### 结构化日志 (logger.js)
- 日志级别：DEBUG/INFO/WARN/ERROR/FATAL
- JSON / 文本 / 彩色 格式
- AI 调用追踪
- Agent 执行追踪
- 日志轮转和清理

## 📊 服务层

### 数据分析 (analytics.js)
- 仪表盘统计
- 会话对比分析
- 周报生成
- 智能洞察（模式/异常/趋势）
- 多格式导出（JSON/CSV）

### 通知服务 (notification.js)
- 多渠道通知（控制台/Webhook/日志）
- 事件驱动（分析完成/高风险/系统错误）
- 通知历史和已读管理
- Webhook 配置管理

### 历史管理 (history.js)
- 全文搜索
- 标签管理
- 备注功能
- 时间线追踪
- 批量操作（归档/打标签）

## 📋 条款模板库

内置 6 类合同条款模板：
- **付款条款** - 预付款、里程碑付款、逾期利息
- **责任条款** - 责任上限、赔偿、不可抗力
- **知识产权** - 归属、源码交付、开源声明
- **保密条款** - 保密义务、数据保护
- **终止条款** - 任意解除、违约解除
- **争议解决** - 仲裁、法院管辖

## 📖 谈判话术库

内置谈判场景话术：
- **开场陈述** - 合作型/竞争型/原则型
- **终场论据** - 成功/僵局/准备
- **反驳话术** - 价格施压/时间施压/竞争施压
- **让步策略** - 渐进式/条件式/打包式

## 🔧 技术栈

- **后端**: Node.js (零依赖，仅用内置模块)
- **前端**: 原生 HTML/CSS/JS (暗色主题仪表盘)
- **数据库**: JSON 文件存储 (零编译)
- **AI**: 小米 MiMo 四模型 (Omni + Pro + TTS + Flash)
- **中间件**: 自研认证/限流/日志
- **测试**: Node.js 内置 assert (零依赖)

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/yuyi8852/ai-negotiation-coach.git
cd ai-negotiation-coach

# 2. 配置 API Key（可选，不配置则使用 Demo 模式）
export MIMO_API_KEY="tp-xxx"

# 3. 启动服务
node server.js

# 4. 打开浏览器
# http://localhost:3000

# 5. 运行测试
node tests/agents.test.js
node tests/utils.test.js
```

## 📊 API 接口

### 核心接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/analyze` | 开始分析 |
| GET | `/api/sessions` | 会话列表 |
| GET | `/api/session/:id` | 会话详情 |
| GET | `/api/stats` | 统计数据 |

### 分析接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/analytics/dashboard` | 仪表盘数据 |
| GET | `/api/analytics/session/:id` | 单会话分析 |
| GET | `/api/analytics/insights` | 智能洞察 |

### 历史接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/history?q=关键词` | 搜索历史 |
| GET | `/api/history/tags` | 标签列表 |
| GET | `/api/history/timeline/:id` | 时间线 |
| POST | `/api/history/archive/:id` | 归档会话 |

### 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| POST | `/api/auth/key` | 生成 API Key |

### Agent 接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents` | Agent 列表 |
| POST | `/api/agents/:name/execute` | 执行特定 Agent |

### 数据接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/industries` | 行业数据 |
| GET | `/api/risk-patterns` | 风险模式 |
| GET | `/api/clause-templates` | 条款模板 |
| GET | `/api/negotiation-scripts` | 谈判话术 |

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行 Agent 测试
npm run test:agents

# 运行工具库测试
npm run test:utils
```

## 📝 配置

支持环境变量配置：

```bash
# 服务
PORT=3000
HOST=0.0.0.0

# MiMo
MIMO_API_KEY=tp-xxx
MIMO_MODEL_PRO=MiMo-V2-Pro

# 认证
AUTH_ENABLED=true
JWT_SECRET=your-secret

# 限流
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW=60000

# 日志
LOG_LEVEL=INFO
LOG_FILE=true

# Demo 模式
DEMO_MODE=true
```

## 📄 License

MIT License
