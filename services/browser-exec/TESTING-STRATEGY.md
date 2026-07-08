# Browser-exec 测试策略文档

## 服务概述

Browser-exec 是一个基于 Playwright 的浏览器自动化服务，提供 4 种访问模式：
1. **evaluate** - Offer 评估模式
2. **click** - 点击模拟模式（真人行为）
3. **resolve** - URL 解析模式
4. **check** - 可用性检测模式

## 当前状态

- **技术栈**: Node.js + Playwright + Express
- **测试框架**: 无
- **测试覆盖率**: 0%

## 推荐测试框架

### 选项 1: Jest (推荐)
```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "jest-playwright-preset": "^4.0.0"
  }
}
```

### 选项 2: Vitest
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0"
  }
}
```

## 测试策略

### 1. 单元测试（优先级：高）

#### 1.1 Visit Modes 测试
**文件**: `lib/visit-modes.test.js`

**测试内容**:
- ✅ getModeConfig - 获取模式配置
- ✅ isValidMode - 验证模式有效性
- ✅ getAvailableModes - 获取所有模式
- ✅ getModeDescription - 获取模式描述
- ✅ recommendMode - 推荐模式
- ✅ deepMerge - 配置合并

**示例测试**:
```javascript
import { describe, it, expect } from 'vitest'
import { getModeConfig, isValidMode, recommendMode } from './visit-modes.js'

describe('Visit Modes', () => {
  describe('isValidMode', () => {
    it('should return true for valid modes', () => {
      expect(isValidMode('evaluate')).toBe(true)
      expect(isValidMode('click')).toBe(true)
      expect(isValidMode('resolve')).toBe(true)
      expect(isValidMode('check')).toBe(true)
    })

    it('should return false for invalid modes', () => {
      expect(isValidMode('invalid')).toBe(false)
      expect(isValidMode('')).toBe(false)
      expect(isValidMode(null)).toBe(false)
    })
  })

  describe('getModeConfig', () => {
    it('should return config for evaluate mode', () => {
      const config = getModeConfig('evaluate')
      expect(config.timeoutMs).toBe(30000)
      expect(config.enableAntiBot).toBe(true)
      expect(config.resourceBlocking).toContain('image')
    })

    it('should merge overrides', () => {
      const config = getModeConfig('evaluate', { timeoutMs: 60000 })
      expect(config.timeoutMs).toBe(60000)
    })

    it('should throw for invalid mode', () => {
      expect(() => getModeConfig('invalid')).toThrow()
    })
  })

  describe('recommendMode', () => {
    it('should recommend evaluate for evaluation scenarios', () => {
      expect(recommendMode('evaluate domain')).toBe('evaluate')
      expect(recommendMode('brand extraction')).toBe('evaluate')
    })

    it('should recommend click for click scenarios', () => {
      expect(recommendMode('simulate click')).toBe('click')
      expect(recommendMode('human behavior')).toBe('click')
    })

    it('should recommend resolve for URL scenarios', () => {
      expect(recommendMode('resolve redirect')).toBe('resolve')
      expect(recommendMode('get final URL')).toBe('resolve')
    })

    it('should recommend check for availability scenarios', () => {
      expect(recommendMode('check availability')).toBe('check')
      expect(recommendMode('status check')).toBe('check')
    })
  })
})
```

#### 1.2 Error Classification 测试
**文件**: `lib/unified-visit.test.js`

**测试内容**:
- ✅ classifyError - 错误分类
- ✅ createErrorResponse - 错误响应创建
- ✅ extractBrandName - 品牌名提取
- ✅ getRandomUserAgent - User-Agent 生成

#### 1.3 Queue 测试
**文件**: `queue.test.js`

**测试内容**:
- ✅ enqueue - 任务入队
- ✅ getTask - 获取任务状态
- ✅ stats - 队列统计
- ✅ setConcurrency - 设置并发数
- ✅ registerHandlers - 注册处理器

### 2. 集成测试（优先级：中）

#### 2.1 Pool 测试
**文件**: `pool.test.js`

**测试内容**:
- ✅ getContext - 获取浏览器上下文
- ✅ release - 释放上下文
- ✅ recycleIdle - 回收空闲池
- ✅ stats - 池统计
- ✅ setLimits - 设置限制

**注意**: 需要 Mock Playwright

#### 2.2 Unified Visit 集成测试
**文件**: `lib/unified-visit.integration.test.js`

**测试内容**:
- ✅ unifiedVisit - 完整访问流程
- ✅ HEAD 请求降级
- ✅ 代理使用
- ✅ 反爬虫检测
- ✅ 数据提取

**注意**: 需要真实的浏览器环境或完整的 Mock

### 3. API 测试（优先级：中）

#### 3.1 HTTP 端点测试
**文件**: `index.test.js`

**测试内容**:
- ✅ GET /healthz
- ✅ GET /health
- ✅ GET /readyz
- ✅ GET /metrics
- ✅ POST /visit (各种模式)
- ✅ GET /queue/stats
- ✅ POST /queue/task

### 4. E2E 测试（优先级：低）

#### 4.1 完整流程测试
**测试内容**:
- ✅ 真实网站访问
- ✅ 反爬虫绕过
- ✅ 数据提取准确性
- ✅ 性能指标

## Mock 策略

### 1. Playwright Mock
```javascript
// __mocks__/playwright-extra.js
export default {
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn(),
          close: jest.fn(),
          url: jest.fn().mockReturnValue('https://example.com'),
          title: jest.fn().mockResolvedValue('Example'),
          content: jest.fn().mockResolvedValue('<html></html>')
        }),
        close: jest.fn()
      }),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    }),
    use: jest.fn()
  }
}
```

### 2. Redis Mock
```javascript
// __mocks__/ioredis.js
export default class Redis {
  constructor() {
    this.data = new Map()
  }
  
  async hmset(key, ...args) {
    this.data.set(key, args)
  }
  
  async hgetall(key) {
    return this.data.get(key) || {}
  }
  
  async rpush(key, value) {
    const list = this.data.get(key) || []
    list.push(value)
    this.data.set(key, list)
  }
  
  async blpop(...keys) {
    for (const key of keys.slice(0, -1)) {
      const list = this.data.get(key) || []
      if (list.length > 0) {
        return [key, list.shift()]
      }
    }
    return null
  }
}
```

## 测试配置

### Jest 配置
**文件**: `jest.config.js`

```javascript
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
}
```

### Vitest 配置
**文件**: `vitest.config.js`

```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'coverage/',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    }
  }
})
```

## 实施步骤

### 阶段 1: 基础设施（1-2 小时）
1. ✅ 选择测试框架（推荐 Vitest）
2. ✅ 安装依赖
3. ✅ 配置测试环境
4. ✅ 创建 Mock 文件

### 阶段 2: 单元测试（3-4 小时）
1. ✅ Visit Modes 测试
2. ✅ Error Classification 测试
3. ✅ Queue 基础测试
4. ✅ 工具函数测试

### 阶段 3: 集成测试（4-6 小时）
1. ✅ Pool 测试（Mock Playwright）
2. ✅ Unified Visit 测试
3. ✅ Queue 完整测试

### 阶段 4: API 测试（2-3 小时）
1. ✅ HTTP 端点测试
2. ✅ 错误处理测试
3. ✅ 指标测试

### 阶段 5: E2E 测试（可选，4-6 小时）
1. ✅ 真实浏览器测试
2. ✅ 性能测试
3. ✅ 压力测试

## 预期覆盖率

- **单元测试**: 70-80%
- **集成测试**: 50-60%
- **总体覆盖率**: 60-70%

## 测试命令

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui"
  }
}
```

## 注意事项

### 1. Playwright 测试挑战
- Playwright 需要真实浏览器或完整 Mock
- 建议使用 `jest-playwright-preset` 或类似工具
- 考虑使用 Docker 容器进行 E2E 测试

### 2. 异步测试
- 所有浏览器操作都是异步的
- 使用 `async/await` 或 Promise
- 设置合理的超时时间

### 3. 资源管理
- 确保测试后关闭浏览器
- 使用 `beforeEach` 和 `afterEach` 清理
- 避免资源泄漏

### 4. 隔离性
- 每个测试应该独立
- 不依赖其他测试的状态
- 使用 Mock 隔离外部依赖

## 快速开始示例

### 安装依赖
```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8
```

### 创建第一个测试
```javascript
// lib/visit-modes.test.js
import { describe, it, expect } from 'vitest'
import { isValidMode } from './visit-modes.js'

describe('Visit Modes', () => {
  it('should validate modes correctly', () => {
    expect(isValidMode('evaluate')).toBe(true)
    expect(isValidMode('invalid')).toBe(false)
  })
})
```

### 运行测试
```bash
npm test
```

## 总结

Browser-exec 是一个复杂的浏览器自动化服务，需要：
1. **完整的测试框架设置**
2. **Playwright Mock 策略**
3. **分层测试方法**（单元 → 集成 → E2E）
4. **合理的覆盖率目标**（60-70%）

由于时间和复杂性限制，建议：
- 优先实现单元测试（visit-modes, error classification）
- 使用 Mock 进行集成测试
- E2E 测试作为可选项

**预计总工作量**: 10-15 小时
**建议优先级**: 中（在完成 Go 服务测试后）
