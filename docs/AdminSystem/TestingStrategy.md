# 后台管理系统测试策略

> 制定日期: 2025-10-10
> 作者: Claude Code
> 目标: 确保后台管理系统可用、好用、易用

---

## 📋 目录

- [1. 测试全景](#1-测试全景)
- [2. 现有测试基础设施](#2-现有测试基础设施)
- [3. 后端测试策略](#3-后端测试策略)
- [4. 前端测试策略](#4-前端测试策略)
- [5. 集成测试策略](#5-集成测试策略)
- [6. E2E测试策略](#6-e2e测试策略)
- [7. 测试数据管理](#7-测试数据管理)
- [8. 测试执行计划](#8-测试执行计划)
- [9. 成功指标](#9-成功指标)

---

## 1. 测试全景

### 1.1 测试金字塔

```
           ┌─────────────┐
          /  E2E Tests   /  ← 10% (关键用户流程)
         /  (Playwright) /
        └───────────────┘
       ┌─────────────────┐
      /  Integration     /   ← 30% (API端到端)
     /  Tests (Go+HTTP) /
    └───────────────────┘
   ┌─────────────────────┐
  /  Unit Tests          /    ← 60% (Handler/组件)
 /  (Go+React Testing)  /
└───────────────────────┘
```

### 1.2 测试覆盖目标

| 层级 | 目标覆盖率 | 工具 | 执行频率 |
|------|----------|------|---------|
| 单元测试 | 80%+ | Go testing, testify | 每次提交 |
| 集成测试 | 70%+ | httptest, pgxmock | 每次PR |
| E2E测试 | 核心流程100% | Playwright | 每日/发布前 |

### 1.3 测试分类

**可用性测试 (Functionality)**
- ✅ 所有API端点正常响应
- ✅ 数据库CRUD操作成功
- ✅ 认证授权机制有效

**好用性测试 (Usability)**
- ✅ 错误消息清晰友好
- ✅ 响应时间 < 500ms (P95)
- ✅ 数据验证完整准确

**易用性测试 (Accessibility)**
- ✅ API文档完整
- ✅ 前端交互流畅
- ✅ 错误可恢复

---

## 2. 现有测试基础设施

### 2.1 后端 (Go)

**已有工具链**:
```go
// services/offer/internal/handlers/http_test.go
import (
    "testing"
    "net/http/httptest"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    pgxmock "github.com/pashagolub/pgxmock/v3"
)
```

**已有测试文件**:
- ✅ `services/console/internal/handlers/navigation_test.go` - pgxmock示例
- ✅ `services/console/internal/handlers/marketing_test.go`
- ✅ `services/console/internal/handlers/web_vitals_test.go`
- ✅ `services/offer/internal/handlers/http_test.go` - HTTP handler测试示例

**测试模式**:
```go
// 1. Mock Database (pgxmock)
mock, _ := pgxmock.NewPool()
handler := &Handler{DB: mock}

// 2. Mock Context (user_id)
ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)

// 3. HTTP Test
req := httptest.NewRequest("GET", "/api/v1/console/...", nil)
w := httptest.NewRecorder()
handler.someHandler(w, req)

// 4. Assert
assert.Equal(t, 200, w.Code)
```

### 2.2 前端 (Next.js)

**已有工具链**:
- ❌ **未发现前端测试配置** (package.json中无test脚本)
- 🔴 **需要添加**: Jest, React Testing Library, Playwright

**建议工具栈**:
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "@playwright/test": "^1.40.0"
  }
}
```

### 2.3 数据库

**测试策略**:
- ✅ **单元测试**: 使用 `pgxmock` (已有示例)
- ✅ **集成测试**: 使用 Docker Compose + PostgreSQL测试数据库
- ✅ **数据隔离**: 每个测试用例独立事务 + Rollback

---

## 3. 后端测试策略

### 3.1 单元测试 (Handler层)

#### 3.1.1 Export Center Handler

**文件**: `services/console/internal/handlers/export_center_test.go`

**测试用例**:

```go
package handlers

import (
    "bytes"
    "context"
    "encoding/json"
    "net/http/httptest"
    "testing"
    "time"

    pgxmock "github.com/pashagolub/pgxmock/v3"
    "github.com/stretchr/testify/assert"
    "github.com/xxrenzhe/autoads/pkg/middleware"
)

func TestListExportHistory_Success(t *testing.T) {
    mock, err := pgxmock.NewPool()
    assert.NoError(t, err)
    defer mock.Close()

    handler := &Handler{DB: mock}

    // Mock ensureExportHistoryTable
    mock.ExpectExec(`CREATE TABLE IF NOT EXISTS export_history`).
        WillReturnResult(pgxmock.NewResult("CREATE", 0))

    // Mock Query
    rows := pgxmock.NewRows([]string{
        "id", "type", "format", "status", "start_date", "end_date",
        "record_count", "file_size", "created_by", "created_at", "completed_at", "error_msg",
    }).AddRow(
        "export-123", "token_usage", "csv", "completed", "2025-01-01", "2025-01-31",
        1500, 45678, "user-1", time.Now(), time.Now(), "",
    )
    mock.ExpectQuery(`SELECT id, type, format`).WillReturnRows(rows)

    req := httptest.NewRequest("GET", "/api/v1/console/exports/history", nil)
    ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-1")
    req = req.WithContext(ctx)
    w := httptest.NewRecorder()

    handler.listExportHistory(w, req)

    assert.Equal(t, 200, w.Code)

    var response map[string]interface{}
    json.NewDecoder(w.Body).Decode(&response)
    assert.Equal(t, float64(1), response["total"])
    assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRecordExportHistory_Success(t *testing.T) {
    mock, err := pgxmock.NewPool()
    assert.NoError(t, err)
    defer mock.Close()

    handler := &Handler{DB: mock}

    // Mock ensureExportHistoryTable
    mock.ExpectExec(`CREATE TABLE IF NOT EXISTS export_history`).
        WillReturnResult(pgxmock.NewResult("CREATE", 0))

    // Mock Insert
    mock.ExpectQuery(`INSERT INTO export_history`).
        WithArgs("token_usage", "csv", "2025-01-01", "2025-01-31", 1000, "user-1").
        WillReturnRows(pgxmock.NewRows([]string{"id"}).AddRow("export-new"))

    payload := map[string]interface{}{
        "type":         "token_usage",
        "format":       "csv",
        "start_date":   "2025-01-01",
        "end_date":     "2025-01-31",
        "record_count": 1000,
    }
    body, _ := json.Marshal(payload)
    req := httptest.NewRequest("POST", "/api/v1/console/exports/record", bytes.NewReader(body))
    ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-1")
    req = req.WithContext(ctx)
    w := httptest.NewRecorder()

    handler.recordExportHistory(w, req)

    assert.Equal(t, 200, w.Code)
    var response map[string]interface{}
    json.NewDecoder(w.Body).Decode(&response)
    assert.True(t, response["success"].(bool))
    assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetExportStats_Success(t *testing.T) {
    mock, err := pgxmock.NewPool()
    assert.NoError(t, err)
    defer mock.Close()

    handler := &Handler{DB: mock}

    mock.ExpectExec(`CREATE TABLE IF NOT EXISTS export_history`).
        WillReturnResult(pgxmock.NewResult("CREATE", 0))

    // Mock aggregate query
    mock.ExpectQuery(`SELECT COUNT\(\*\)`).
        WillReturnRows(pgxmock.NewRows([]string{"total", "today", "week", "total_records"}).
            AddRow(100, 5, 20, int64(50000)))

    // Mock type breakdown
    typeRows := pgxmock.NewRows([]string{"type", "count"}).
        AddRow("token_usage", 60).
        AddRow("offer_metrics", 40)
    mock.ExpectQuery(`SELECT type, COUNT`).WillReturnRows(typeRows)

    req := httptest.NewRequest("GET", "/api/v1/console/exports/stats", nil)
    ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-1")
    req = req.WithContext(ctx)
    w := httptest.NewRecorder()

    handler.getExportStats(w, req)

    assert.Equal(t, 200, w.Code)
    var stats ExportStats
    json.NewDecoder(w.Body).Decode(&stats)
    assert.Equal(t, 100, stats.TotalExports)
    assert.Equal(t, 5, stats.TodayExports)
    assert.NoError(t, mock.ExpectationsWereMet())
}
```

**覆盖目标**:
- ✅ 正常流程 (200 OK)
- ✅ 参数验证 (400 Bad Request)
- ✅ 数据库错误 (500 Internal Server Error)
- ✅ 认证失败 (401 Unauthorized)

#### 3.1.2 Feature Flags Handler

**文件**: `services/console/internal/handlers/feature_flags_test.go`

**测试用例**:

```go
func TestListFeatureFlags_Success(t *testing.T) {
    mock, _ := pgxmock.NewPool()
    defer mock.Close()

    handler := &Handler{DB: mock}

    mock.ExpectExec(`CREATE TABLE IF NOT EXISTS feature_flags`).
        WillReturnResult(pgxmock.NewResult("CREATE", 0))

    rows := pgxmock.NewRows([]string{"key", "enabled", "description", "created_at", "updated_at", "updated_by"}).
        AddRow("feature_a", true, "Feature A", time.Now(), time.Now(), "admin-1").
        AddRow("feature_b", false, "Feature B", time.Now(), time.Now(), "admin-2")
    mock.ExpectQuery(`SELECT key, enabled`).WillReturnRows(rows)

    req := httptest.NewRequest("GET", "/api/v1/console/feature-flags", nil)
    w := httptest.NewRecorder()

    handler.listFeatureFlags(w, req)

    assert.Equal(t, 200, w.Code)
    var response map[string]interface{}
    json.NewDecoder(w.Body).Decode(&response)
    assert.Equal(t, float64(2), response["total"])
}

func TestCreateFeatureFlag_Success(t *testing.T) {
    mock, _ := pgxmock.NewPool()
    defer mock.Close()

    handler := &Handler{DB: mock}

    mock.ExpectExec(`CREATE TABLE IF NOT EXISTS feature_flags`).
        WillReturnResult(pgxmock.NewResult("CREATE", 0))

    mock.ExpectExec(`INSERT INTO feature_flags`).
        WithArgs("new_feature", true, "Test feature", "admin-1").
        WillReturnResult(pgxmock.NewResult("INSERT", 1))

    payload := map[string]interface{}{
        "key":         "new_feature",
        "enabled":     true,
        "description": "Test feature",
    }
    body, _ := json.Marshal(payload)
    req := httptest.NewRequest("POST", "/api/v1/console/feature-flags", bytes.NewReader(body))
    ctx := context.WithValue(req.Context(), middleware.UserIDKey, "admin-1")
    req = req.WithContext(ctx)
    w := httptest.NewRecorder()

    handler.createFeatureFlag(w, req)

    assert.Equal(t, 200, w.Code)
}

func TestUpdateFeatureFlag_TrackHistory(t *testing.T) {
    mock, _ := pgxmock.NewPool()
    defer mock.Close()

    handler := &Handler{DB: mock}

    mock.ExpectExec(`CREATE TABLE IF NOT EXISTS feature_flags`).
        WillReturnResult(pgxmock.NewResult("CREATE", 0))

    // Get old value
    mock.ExpectQuery(`SELECT enabled FROM feature_flags WHERE key`).
        WithArgs("feature_a").
        WillReturnRows(pgxmock.NewRows([]string{"enabled"}).AddRow(false))

    // Update flag
    mock.ExpectExec(`UPDATE feature_flags SET enabled`).
        WithArgs(true, "Updated description", "admin-1", "feature_a").
        WillReturnResult(pgxmock.NewResult("UPDATE", 1))

    // Insert history
    mock.ExpectExec(`INSERT INTO feature_flag_history`).
        WithArgs("feature_a", false, true, "admin-1", "Enable for production").
        WillReturnResult(pgxmock.NewResult("INSERT", 1))

    payload := map[string]interface{}{
        "enabled":     true,
        "description": "Updated description",
        "reason":      "Enable for production",
    }
    body, _ := json.Marshal(payload)
    req := httptest.NewRequest("PUT", "/api/v1/console/feature-flags/feature_a", bytes.NewReader(body))
    ctx := context.WithValue(req.Context(), middleware.UserIDKey, "admin-1")
    req = req.WithContext(ctx)
    w := httptest.NewRecorder()

    handler.updateFeatureFlag(w, req)

    assert.Equal(t, 200, w.Code)
    assert.NoError(t, mock.ExpectationsWereMet())
}
```

#### 3.1.3 Notifications Handler

**文件**: `services/console/internal/handlers/notifications_test.go`

**关键测试**:

```go
func TestRenderTemplate_VariableReplacement(t *testing.T) {
    tests := []struct {
        name     string
        template string
        context  map[string]interface{}
        want     string
    }{
        {
            name:     "simple variable",
            template: "Hello {{user.name}}!",
            context:  map[string]interface{}{"user.name": "Alice"},
            want:     "Hello Alice!",
        },
        {
            name:     "multiple variables",
            template: "{{user.name}} has {{offer.count}} offers",
            context:  map[string]interface{}{"user.name": "Bob", "offer.count": 5},
            want:     "Bob has 5 offers",
        },
        {
            name:     "conditional if - truthy",
            template: "{{#if premium}}Premium User{{/if}}",
            context:  map[string]interface{}{"premium": true},
            want:     "Premium User",
        },
        {
            name:     "conditional if - falsy",
            template: "{{#if premium}}Premium User{{/if}}",
            context:  map[string]interface{}{"premium": false},
            want:     "",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := renderTemplate(tt.template, tt.context)
            assert.Equal(t, tt.want, got)
        })
    }
}

func TestExtractTemplateVariables(t *testing.T) {
    body := "Hello {{user.name}}, check {{offer.url}}. {{#if vip}}VIP content{{/if}}"
    vars := extractTemplateVariables(body)

    assert.Contains(t, vars, "user.name")
    assert.Contains(t, vars, "offer.url")
    assert.Contains(t, vars, "vip")
    assert.NotContains(t, vars, "#if") // Should skip helpers
}

func TestBroadcastNotification_Success(t *testing.T) {
    mock, _ := pgxmock.NewPool()
    defer mock.Close()

    handler := &Handler{DB: mock}

    // Mock ensureNotificationTables
    mock.ExpectExec(`CREATE TABLE IF NOT EXISTS notification_templates`).
        WillReturnResult(pgxmock.NewResult("CREATE", 0))

    // Mock template query
    mock.ExpectQuery(`SELECT id, name, type, subject, body`).
        WithArgs("template-123").
        WillReturnRows(pgxmock.NewRows([]string{"id", "name", "type", "subject", "body", "variables"}).
            AddRow("template-123", "Welcome", "email", "Welcome {{user.name}}", "Hello {{user.name}}", `["user.name"]`))

    // Mock target users query
    usersRows := pgxmock.NewRows([]string{"id", "email", "display_name"}).
        AddRow("user-1", "alice@example.com", "Alice").
        AddRow("user-2", "bob@example.com", "Bob")
    mock.ExpectQuery(`SELECT id, email, display_name FROM users`).WillReturnRows(usersRows)

    // Mock broadcast insert
    mock.ExpectQuery(`INSERT INTO notification_broadcasts`).
        WithArgs("template-123", "all", 2, "admin-1").
        WillReturnRows(pgxmock.NewRows([]string{"id"}).AddRow("broadcast-456"))

    payload := map[string]interface{}{
        "templateId":  "template-123",
        "targetGroup": "all",
    }
    body, _ := json.Marshal(payload)
    req := httptest.NewRequest("POST", "/api/v1/console/notifications/broadcast", bytes.NewReader(body))
    ctx := context.WithValue(req.Context(), middleware.UserIDKey, "admin-1")
    req = req.WithContext(ctx)
    w := httptest.NewRecorder()

    handler.broadcastNotification(w, req)

    assert.Equal(t, 200, w.Code)
    var response map[string]interface{}
    json.NewDecoder(w.Body).Decode(&response)
    assert.True(t, response["success"].(bool))
    assert.Equal(t, "broadcast-456", response["broadcast_id"])
}
```

### 3.2 测试覆盖清单

| Handler | 测试文件 | 关键用例 | 优先级 |
|---------|---------|---------|--------|
| export_center.go | export_center_test.go | 列表/记录/统计 | 🔴 P0 |
| feature_flags.go | feature_flags_test.go | CRUD + 历史 | 🔴 P0 |
| notifications.go | notifications_test.go | 模板渲染 + 广播 | 🔴 P0 |
| users.go | users_test.go | 用户管理 | 🟡 P1 |
| tokens.go | tokens_test.go | Token操作 | 🟡 P1 |
| organizations.go | organizations_test.go | 组织管理 | 🟡 P1 |

---

## 4. 前端测试策略

### 4.1 组件单元测试

#### 4.1.1 配置 Jest + React Testing Library

**文件**: `apps/frontend/jest.config.js`

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

**文件**: `apps/frontend/jest.setup.js`

```javascript
import '@testing-library/jest-dom'
```

**文件**: `apps/frontend/package.json` (更新)

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

#### 4.1.2 Export Center 页面测试

**文件**: `apps/frontend/src/app/manage/exports/__tests__/ExportCenterPageClient.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportCenterPageClient } from '../components/ExportCenterPageClient'
import * as consoleApi from '@/lib/console-api-client'

jest.mock('@/lib/console-api-client')

describe('ExportCenterPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders export history table', async () => {
    const mockHistory = [
      {
        id: 'export-1',
        type: 'token_usage',
        format: 'csv',
        status: 'completed',
        record_count: 1000,
        created_at: '2025-01-10T10:00:00Z',
      },
    ]

    jest.spyOn(consoleApi, 'getExportHistory').mockResolvedValue({
      history: mockHistory,
      total: 1,
    })

    render(<ExportCenterPageClient />)

    await waitFor(() => {
      expect(screen.getByText('token_usage')).toBeInTheDocument()
      expect(screen.getByText('csv')).toBeInTheDocument()
      expect(screen.getByText('1000')).toBeInTheDocument()
    })
  })

  it('handles export record submission', async () => {
    jest.spyOn(consoleApi, 'recordExportHistory').mockResolvedValue({
      success: true,
      export_id: 'export-new',
    })

    render(<ExportCenterPageClient />)

    fireEvent.click(screen.getByText(/record new export/i))

    const typeSelect = screen.getByLabelText(/type/i)
    fireEvent.change(typeSelect, { target: { value: 'token_usage' } })

    const formatSelect = screen.getByLabelText(/format/i)
    fireEvent.change(formatSelect, { target: { value: 'csv' } })

    const submitButton = screen.getByRole('button', { name: /submit/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(consoleApi.recordExportHistory).toHaveBeenCalledWith({
        type: 'token_usage',
        format: 'csv',
      })
    })
  })

  it('displays export statistics', async () => {
    const mockStats = {
      total_exports: 100,
      today_exports: 5,
      week_exports: 20,
      total_records: 50000,
      type_breakdown: { token_usage: 60, offer_metrics: 40 },
    }

    jest.spyOn(consoleApi, 'getExportStats').mockResolvedValue(mockStats)

    render(<ExportCenterPageClient />)

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument() // total
      expect(screen.getByText('5')).toBeInTheDocument() // today
      expect(screen.getByText('20')).toBeInTheDocument() // week
    })
  })
})
```

#### 4.1.3 Feature Flags 页面测试

**文件**: `apps/frontend/src/app/manage/feature-flags/__tests__/FeatureFlagsPageClient.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FeatureFlagsPageClient } from '../components/FeatureFlagsPageClient'
import * as consoleApi from '@/lib/console-api-client'

jest.mock('@/lib/console-api-client')

describe('FeatureFlagsPageClient', () => {
  it('renders feature flags list', async () => {
    const mockFlags = [
      { key: 'feature_a', enabled: true, description: 'Feature A' },
      { key: 'feature_b', enabled: false, description: 'Feature B' },
    ]

    jest.spyOn(consoleApi, 'listFeatureFlags').mockResolvedValue({
      flags: mockFlags,
      total: 2,
    })

    render(<FeatureFlagsPageClient />)

    await waitFor(() => {
      expect(screen.getByText('feature_a')).toBeInTheDocument()
      expect(screen.getByText('Feature A')).toBeInTheDocument()
    })
  })

  it('toggles feature flag', async () => {
    jest.spyOn(consoleApi, 'updateFeatureFlag').mockResolvedValue({
      success: true,
    })

    const mockFlags = [
      { key: 'feature_a', enabled: false, description: 'Feature A' },
    ]

    jest.spyOn(consoleApi, 'listFeatureFlags').mockResolvedValue({
      flags: mockFlags,
      total: 1,
    })

    render(<FeatureFlagsPageClient />)

    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: /feature_a/i })
      fireEvent.click(toggle)
    })

    await waitFor(() => {
      expect(consoleApi.updateFeatureFlag).toHaveBeenCalledWith('feature_a', {
        enabled: true,
      })
    })
  })

  it('creates new feature flag', async () => {
    jest.spyOn(consoleApi, 'createFeatureFlag').mockResolvedValue({
      success: true,
      key: 'new_feature',
    })

    render(<FeatureFlagsPageClient />)

    fireEvent.click(screen.getByText(/create new flag/i))

    const keyInput = screen.getByLabelText(/key/i)
    fireEvent.change(keyInput, { target: { value: 'new_feature' } })

    const descInput = screen.getByLabelText(/description/i)
    fireEvent.change(descInput, { target: { value: 'New Feature' } })

    const submitButton = screen.getByRole('button', { name: /create/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(consoleApi.createFeatureFlag).toHaveBeenCalledWith({
        key: 'new_feature',
        enabled: false,
        description: 'New Feature',
      })
    })
  })
})
```

#### 4.1.4 Notifications 页面测试

**文件**: `apps/frontend/src/app/manage/notifications/__tests__/NotificationsPageClient.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationsPageClient } from '../components/NotificationsPageClient'
import * as consoleApi from '@/lib/console-api-client'

describe('NotificationsPageClient', () => {
  it('renders template variable hints', () => {
    render(<NotificationsPageClient />)

    expect(screen.getByText(/Template Variables/i)).toBeInTheDocument()
    expect(screen.getByText(/{{user.name}}/)).toBeInTheDocument()
    expect(screen.getByText(/{{offer.url}}/)).toBeInTheDocument()
  })

  it('previews template with sample data', async () => {
    jest.spyOn(consoleApi, 'previewNotificationTemplate').mockResolvedValue({
      subject: 'Welcome John Doe',
      body: 'Hello John Doe, check https://example.com/offer',
      variables: ['user.name', 'offer.url'],
    })

    render(<NotificationsPageClient />)

    const subjectInput = screen.getByLabelText(/subject/i)
    fireEvent.change(subjectInput, { target: { value: 'Welcome {{user.name}}' } })

    const bodyInput = screen.getByLabelText(/body/i)
    fireEvent.change(bodyInput, {
      target: { value: 'Hello {{user.name}}, check {{offer.url}}' },
    })

    const previewButton = screen.getByText(/preview/i)
    fireEvent.click(previewButton)

    await waitFor(() => {
      expect(screen.getByText('Welcome John Doe')).toBeInTheDocument()
    })
  })

  it('broadcasts notification to target group', async () => {
    jest.spyOn(consoleApi, 'broadcastNotification').mockResolvedValue({
      success: true,
      broadcast_id: 'broadcast-123',
      totalTargets: 50,
    })

    render(<NotificationsPageClient />)

    const templateSelect = screen.getByLabelText(/template/i)
    fireEvent.change(templateSelect, { target: { value: 'template-123' } })

    const groupSelect = screen.getByLabelText(/target group/i)
    fireEvent.change(groupSelect, { target: { value: 'vip' } })

    const broadcastButton = screen.getByRole('button', { name: /broadcast/i })
    fireEvent.click(broadcastButton)

    await waitFor(() => {
      expect(consoleApi.broadcastNotification).toHaveBeenCalledWith({
        templateId: 'template-123',
        targetGroup: 'vip',
      })
      expect(screen.getByText(/50 users/i)).toBeInTheDocument()
    })
  })
})
```

### 4.2 前端测试覆盖清单

| 页面组件 | 测试文件 | 关键用例 | 优先级 |
|---------|---------|---------|--------|
| ExportCenterPageClient | ExportCenterPageClient.test.tsx | 列表/记录/统计 | 🔴 P0 |
| FeatureFlagsPageClient | FeatureFlagsPageClient.test.tsx | 列表/切换/创建 | 🔴 P0 |
| NotificationsPageClient | NotificationsPageClient.test.tsx | 模板/预览/广播 | 🔴 P0 |
| UsersPageClient | UsersPageClient.test.tsx | 用户列表/搜索 | 🟡 P1 |
| TokensPageClient | TokensPageClient.test.tsx | Token余额/调整 | 🟡 P1 |

---

## 5. 集成测试策略

### 5.1 API端到端测试

#### 5.1.1 测试环境配置

**文件**: `services/console/test/integration_test.go`

```go
package test

import (
    "context"
    "fmt"
    "os"
    "testing"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/xxrenzhe/autoads/services/console/internal/handlers"
)

var (
    testDB  *pgxpool.Pool
    testHandler *handlers.Handler
)

func TestMain(m *testing.M) {
    // Setup
    ctx := context.Background()

    dbURL := os.Getenv("TEST_DATABASE_URL")
    if dbURL == "" {
        dbURL = "postgres://autoads:password@localhost:5432/autoads_test?sslmode=disable"
    }

    var err error
    testDB, err = pgxpool.New(ctx, dbURL)
    if err != nil {
        panic(fmt.Sprintf("Unable to connect to test database: %v", err))
    }

    // Create handler
    testHandler = &handlers.Handler{DB: testDB}

    // Run tests
    code := m.Run()

    // Teardown
    testDB.Close()
    os.Exit(code)
}

func cleanupDatabase(t *testing.T) {
    ctx := context.Background()
    tables := []string{
        "export_history",
        "feature_flags",
        "feature_flag_history",
        "notification_templates",
        "notification_broadcasts",
    }

    for _, table := range tables {
        _, err := testDB.Exec(ctx, fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table))
        if err != nil {
            // Table might not exist yet
            t.Logf("Warning: Failed to truncate %s: %v", table, err)
        }
    }
}
```

#### 5.1.2 Export Center 集成测试

**文件**: `services/console/test/export_center_integration_test.go`

```go
package test

import (
    "bytes"
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/xxrenzhe/autoads/pkg/middleware"
)

func TestExportCenter_FullCycle(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping integration test")
    }

    cleanupDatabase(t)
    ctx := context.Background()
    userID := "test-user-integration"

    // 1. Ensure tables are created
    err := testHandler.ensureExportHistoryTable(ctx)
    assert.NoError(t, err)

    // 2. List exports (should be empty)
    req := httptest.NewRequest("GET", "/api/v1/console/exports/history", nil)
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w := httptest.NewRecorder()
    testHandler.listExportHistory(w, req)
    assert.Equal(t, 200, w.Code)

    var listResp map[string]interface{}
    json.NewDecoder(w.Body).Decode(&listResp)
    assert.Equal(t, float64(0), listResp["total"])

    // 3. Record an export
    payload := map[string]interface{}{
        "type":         "token_usage",
        "format":       "csv",
        "start_date":   "2025-01-01",
        "end_date":     "2025-01-31",
        "record_count": 1500,
    }
    body, _ := json.Marshal(payload)
    req = httptest.NewRequest("POST", "/api/v1/console/exports/record", bytes.NewReader(body))
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w = httptest.NewRecorder()
    testHandler.recordExportHistory(w, req)
    assert.Equal(t, 200, w.Code)

    var recordResp map[string]interface{}
    json.NewDecoder(w.Body).Decode(&recordResp)
    assert.True(t, recordResp["success"].(bool))
    exportID := recordResp["export_id"].(string)
    assert.NotEmpty(t, exportID)

    // 4. List exports again (should have 1)
    req = httptest.NewRequest("GET", "/api/v1/console/exports/history", nil)
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w = httptest.NewRecorder()
    testHandler.listExportHistory(w, req)
    assert.Equal(t, 200, w.Code)

    json.NewDecoder(w.Body).Decode(&listResp)
    assert.Equal(t, float64(1), listResp["total"])

    // 5. Get stats
    req = httptest.NewRequest("GET", "/api/v1/console/exports/stats", nil)
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w = httptest.NewRecorder()
    testHandler.getExportStats(w, req)
    assert.Equal(t, 200, w.Code)

    var statsResp map[string]interface{}
    json.NewDecoder(w.Body).Decode(&statsResp)
    assert.Equal(t, float64(1), statsResp["total_exports"])
    assert.Equal(t, float64(1), statsResp["today_exports"])
}
```

#### 5.1.3 Feature Flags 集成测试

**文件**: `services/console/test/feature_flags_integration_test.go`

```go
package test

import (
    "bytes"
    "context"
    "encoding/json"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/xxrenzhe/autoads/pkg/middleware"
)

func TestFeatureFlags_CRUD_Cycle(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping integration test")
    }

    cleanupDatabase(t)
    ctx := context.Background()
    userID := "admin-integration"

    // 1. Create feature flag
    createPayload := map[string]interface{}{
        "key":         "test_feature",
        "enabled":     false,
        "description": "Test Feature",
    }
    body, _ := json.Marshal(createPayload)
    req := httptest.NewRequest("POST", "/api/v1/console/feature-flags", bytes.NewReader(body))
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w := httptest.NewRecorder()
    testHandler.createFeatureFlag(w, req)
    assert.Equal(t, 200, w.Code)

    // 2. List flags (should have 1)
    req = httptest.NewRequest("GET", "/api/v1/console/feature-flags", nil)
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w = httptest.NewRecorder()
    testHandler.listFeatureFlags(w, req)
    assert.Equal(t, 200, w.Code)

    var listResp map[string]interface{}
    json.NewDecoder(w.Body).Decode(&listResp)
    assert.Equal(t, float64(1), listResp["total"])

    // 3. Update flag (enable it)
    updatePayload := map[string]interface{}{
        "enabled":     true,
        "description": "Updated Test Feature",
        "reason":      "Enabling for testing",
    }
    body, _ = json.Marshal(updatePayload)
    req = httptest.NewRequest("PUT", "/api/v1/console/feature-flags/test_feature", bytes.NewReader(body))
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w = httptest.NewRecorder()
    testHandler.updateFeatureFlag(w, req)
    assert.Equal(t, 200, w.Code)

    // 4. Get history (should have 1 change)
    req = httptest.NewRequest("GET", "/api/v1/console/feature-flags/test_feature/history", nil)
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w = httptest.NewRecorder()
    testHandler.getFeatureFlagHistory(w, req)
    assert.Equal(t, 200, w.Code)

    var historyResp map[string]interface{}
    json.NewDecoder(w.Body).Decode(&historyResp)
    assert.Equal(t, float64(1), historyResp["total"])

    // 5. Delete flag
    req = httptest.NewRequest("DELETE", "/api/v1/console/feature-flags/test_feature", nil)
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w = httptest.NewRecorder()
    testHandler.deleteFeatureFlag(w, req)
    assert.Equal(t, 200, w.Code)

    // 6. List flags (should be empty)
    req = httptest.NewRequest("GET", "/api/v1/console/feature-flags", nil)
    req = req.WithContext(context.WithValue(ctx, middleware.UserIDKey, userID))
    w = httptest.NewRecorder()
    testHandler.listFeatureFlags(w, req)
    assert.Equal(t, 200, w.Code)

    json.NewDecoder(w.Body).Decode(&listResp)
    assert.Equal(t, float64(0), listResp["total"])
}
```

### 5.2 运行集成测试

**文件**: `services/console/Makefile`

```makefile
.PHONY: test test-unit test-integration

test: test-unit test-integration

test-unit:
	go test -v -short ./...

test-integration:
	@echo "Starting PostgreSQL test database..."
	docker-compose -f docker-compose.test.yml up -d postgres
	@echo "Waiting for database to be ready..."
	sleep 3
	@echo "Running integration tests..."
	TEST_DATABASE_URL="postgres://autoads:password@localhost:5433/autoads_test?sslmode=disable" \
		go test -v ./test/...
	@echo "Stopping test database..."
	docker-compose -f docker-compose.test.yml down
```

**文件**: `services/console/docker-compose.test.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: autoads
      POSTGRES_PASSWORD: password
      POSTGRES_DB: autoads_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
```

---

## 6. E2E测试策略

### 6.1 Playwright配置

**文件**: `apps/frontend/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### 6.2 E2E测试用例

#### 6.2.1 Export Center E2E

**文件**: `apps/frontend/e2e/export-center.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Export Center', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/auth/sign-in')
    await page.fill('input[name="email"]', 'admin@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard/**')

    // Navigate to Export Center
    await page.goto('/manage/exports')
  })

  test('displays export history', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Export Center')
    await expect(page.locator('table')).toBeVisible()
  })

  test('records new export', async ({ page }) => {
    await page.click('button:has-text("New Export")')
    await page.selectOption('select[name="type"]', 'token_usage')
    await page.selectOption('select[name="format"]', 'csv')
    await page.fill('input[name="start_date"]', '2025-01-01')
    await page.fill('input[name="end_date"]', '2025-01-31')
    await page.fill('input[name="record_count"]', '1000')
    await page.click('button:has-text("Submit")')

    await expect(page.locator('.success-message')).toBeVisible()
    await expect(page.locator('table tr')).toContainText('token_usage')
  })

  test('displays export statistics', async ({ page }) => {
    await expect(page.locator('[data-testid="total-exports"]')).toBeVisible()
    await expect(page.locator('[data-testid="today-exports"]')).toBeVisible()
    await expect(page.locator('[data-testid="week-exports"]')).toBeVisible()
  })
})
```

#### 6.2.2 Feature Flags E2E

**文件**: `apps/frontend/e2e/feature-flags.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Flags', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.fill('input[name="email"]', 'admin@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard/**')
    await page.goto('/manage/feature-flags')
  })

  test('creates new feature flag', async ({ page }) => {
    await page.click('button:has-text("New Flag")')
    await page.fill('input[name="key"]', 'e2e_test_feature')
    await page.fill('input[name="description"]', 'E2E Test Feature')
    await page.click('button:has-text("Create")')

    await expect(page.locator('.success-message')).toContainText('created')
    await expect(page.locator('table')).toContainText('e2e_test_feature')
  })

  test('toggles feature flag', async ({ page }) => {
    // Assuming a flag exists
    const toggle = page.locator('table tr:first-child input[type="checkbox"]')
    const initialState = await toggle.isChecked()

    await toggle.click()
    await page.waitForTimeout(1000) // Wait for API call

    const newState = await toggle.isChecked()
    expect(newState).toBe(!initialState)
  })

  test('views feature flag history', async ({ page }) => {
    await page.click('table tr:first-child button:has-text("History")')
    await expect(page.locator('dialog')).toBeVisible()
    await expect(page.locator('dialog table')).toBeVisible()
  })

  test('deletes feature flag', async ({ page }) => {
    const rowCount = await page.locator('table tbody tr').count()

    await page.click('table tr:last-child button:has-text("Delete")')
    await page.click('button:has-text("Confirm")')

    await page.waitForTimeout(1000)
    const newRowCount = await page.locator('table tbody tr').count()
    expect(newRowCount).toBe(rowCount - 1)
  })
})
```

#### 6.2.3 Notifications E2E

**文件**: `apps/frontend/e2e/notifications.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.fill('input[name="email"]', 'admin@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard/**')
    await page.goto('/manage/notifications')
  })

  test('creates notification template', async ({ page }) => {
    await page.click('button:has-text("New Template")')
    await page.fill('input[name="name"]', 'E2E Test Template')
    await page.selectOption('select[name="type"]', 'email')
    await page.fill('input[name="subject"]', 'Welcome {{user.name}}')
    await page.fill('textarea[name="body"]', 'Hello {{user.name}}, welcome!')
    await page.click('button:has-text("Create")')

    await expect(page.locator('.success-message')).toBeVisible()
    await expect(page.locator('table')).toContainText('E2E Test Template')
  })

  test('previews template', async ({ page }) => {
    await page.click('button:has-text("New Template")')
    await page.fill('input[name="subject"]', 'Hi {{user.name}}')
    await page.fill('textarea[name="body"]', 'Your balance is {{token.balance}}')
    await page.click('button:has-text("Preview")')

    await expect(page.locator('[data-testid="preview-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="preview-subject"]')).toContainText('Hi John Doe')
    await expect(page.locator('[data-testid="preview-body"]')).toContainText('Your balance is')
  })

  test('broadcasts notification', async ({ page }) => {
    await page.click('table tr:first-child button:has-text("Broadcast")')
    await page.selectOption('select[name="targetGroup"]', 'vip')
    await page.click('button:has-text("Send")')

    await expect(page.locator('.success-message')).toContainText('broadcast started')
  })

  test('views broadcast history', async ({ page }) => {
    await page.click('a:has-text("Broadcast History")')
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('table th')).toContainText('Template')
    await expect(page.locator('table th')).toContainText('Target Group')
    await expect(page.locator('table th')).toContainText('Status')
  })
})
```

### 6.3 E2E测试运行

**文件**: `apps/frontend/package.json` (更新)

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

---

## 7. 测试数据管理

### 7.1 测试数据工厂

**文件**: `services/console/test/factory/factory.go`

```go
package factory

import (
    "context"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
)

type TestDataFactory struct {
    DB *pgxpool.Pool
}

func (f *TestDataFactory) CreateUser(ctx context.Context, userID string) error {
    _, err := f.DB.Exec(ctx, `
        INSERT INTO users (id, email, display_name, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO NOTHING
    `, userID, userID+"@test.com", "Test User "+userID)
    return err
}

func (f *TestDataFactory) CreateExportHistory(ctx context.Context, userID string, exportType string) (string, error) {
    var exportID string
    err := f.DB.QueryRow(ctx, `
        INSERT INTO export_history (type, format, status, record_count, created_by)
        VALUES ($1, 'csv', 'completed', 1000, $2)
        RETURNING id
    `, exportType, userID).Scan(&exportID)
    return exportID, err
}

func (f *TestDataFactory) CreateFeatureFlag(ctx context.Context, key string, enabled bool, createdBy string) error {
    _, err := f.DB.Exec(ctx, `
        INSERT INTO feature_flags (key, enabled, description, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE SET enabled = $2
    `, key, enabled, "Test flag "+key, createdBy)
    return err
}

func (f *TestDataFactory) CreateNotificationTemplate(ctx context.Context, name string, createdBy string) (string, error) {
    var templateID string
    err := f.DB.QueryRow(ctx, `
        INSERT INTO notification_templates (name, type, subject, body, variables, created_by)
        VALUES ($1, 'email', 'Test {{user.name}}', 'Hello {{user.name}}', '["user.name"]', $2)
        RETURNING id
    `, name, createdBy).Scan(&templateID)
    return templateID, err
}

func (f *TestDataFactory) CleanupAll(ctx context.Context) error {
    tables := []string{
        "export_history",
        "feature_flags",
        "feature_flag_history",
        "notification_templates",
        "notification_broadcasts",
        "user_notifications",
    }

    for _, table := range tables {
        _, err := f.DB.Exec(ctx, "TRUNCATE TABLE "+table+" CASCADE")
        if err != nil {
            return err
        }
    }
    return nil
}
```

### 7.2 前端测试数据Mock

**文件**: `apps/frontend/src/__tests__/mocks/console-api.ts`

```typescript
export const mockExportHistory = [
  {
    id: 'export-1',
    type: 'token_usage',
    format: 'csv',
    status: 'completed',
    start_date: '2025-01-01',
    end_date: '2025-01-31',
    record_count: 1500,
    created_by: 'admin-1',
    created_at: '2025-01-10T10:00:00Z',
  },
  {
    id: 'export-2',
    type: 'offer_metrics',
    format: 'json',
    status: 'completed',
    start_date: '2025-01-01',
    end_date: '2025-01-31',
    record_count: 2000,
    created_by: 'admin-1',
    created_at: '2025-01-09T15:00:00Z',
  },
]

export const mockFeatureFlags = [
  {
    key: 'feature_a',
    enabled: true,
    description: 'Feature A for testing',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-05T00:00:00Z',
    updated_by: 'admin-1',
  },
  {
    key: 'feature_b',
    enabled: false,
    description: 'Feature B for testing',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    updated_by: 'admin-1',
  },
]

export const mockNotificationTemplates = [
  {
    id: 'template-1',
    name: 'Welcome Email',
    type: 'email',
    subject: 'Welcome {{user.name}}',
    body: 'Hello {{user.name}}, welcome to our platform!',
    variables: ['user.name'],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    created_by: 'admin-1',
  },
]
```

---

## 8. 测试执行计划

### 8.1 本地开发流程

```bash
# 1. 后端单元测试 (快速反馈)
cd services/console
go test -v -short ./internal/handlers/...

# 2. 前端组件测试
cd apps/frontend
npm run test

# 3. 后端集成测试 (需要数据库)
cd services/console
make test-integration

# 4. E2E测试 (需要完整环境)
cd apps/frontend
npm run test:e2e
```

### 8.2 CI/CD流程

**文件**: `.github/workflows/admin-system-tests.yml`

```yaml
name: Admin System Tests

on:
  pull_request:
    paths:
      - 'services/console/**'
      - 'apps/frontend/src/app/manage/**'
  push:
    branches: [main, production]

jobs:
  backend-unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - name: Run Go Unit Tests
        run: |
          cd services/console
          go test -v -short -coverprofile=coverage.out ./...
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./services/console/coverage.out

  backend-integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: autoads
          POSTGRES_PASSWORD: password
          POSTGRES_DB: autoads_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - name: Run Integration Tests
        env:
          TEST_DATABASE_URL: postgres://autoads:password@localhost:5432/autoads_test?sslmode=disable
        run: |
          cd services/console
          go test -v ./test/...

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install Dependencies
        run: |
          cd apps/frontend
          npm ci
      - name: Run Frontend Tests
        run: |
          cd apps/frontend
          npm run test -- --coverage
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/frontend/coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install Dependencies
        run: |
          cd apps/frontend
          npm ci
          npx playwright install --with-deps
      - name: Start Services
        run: |
          docker-compose up -d
          sleep 10
      - name: Run E2E Tests
        env:
          BASE_URL: http://localhost:3000
        run: |
          cd apps/frontend
          npm run test:e2e
      - name: Upload Playwright Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: apps/frontend/playwright-report/
```

### 8.3 测试执行时间表

| 阶段 | 测试类型 | 执行频率 | 预计耗时 |
|------|---------|---------|---------|
| 开发中 | 单元测试 | 每次保存 | 5-10秒 |
| 提交前 | 单元测试 | 每次提交 | 30秒 |
| PR | 单元+集成 | 每个PR | 3-5分钟 |
| 合并 | 全部测试 | 合并到main | 10-15分钟 |
| 发布 | E2E测试 | 发布前 | 20-30分钟 |
| 夜间 | 完整回归 | 每日凌晨 | 30-60分钟 |

---

## 9. 成功指标

### 9.1 可用性指标

| 指标 | 目标 | 当前 | 测试覆盖 |
|------|------|------|---------|
| API可用性 | 99.9% | TBD | 集成测试 |
| 响应成功率 | >99% | TBD | 单元+集成 |
| 错误恢复率 | 100% | TBD | E2E测试 |

### 9.2 好用性指标

| 指标 | 目标 | 当前 | 测试覆盖 |
|------|------|------|---------|
| P95响应时间 | <500ms | TBD | 性能测试 |
| P99响应时间 | <1000ms | TBD | 性能测试 |
| 错误消息可读性 | 100% | TBD | 单元测试 |
| 数据验证完整性 | 100% | TBD | 单元+集成 |

### 9.3 易用性指标

| 指标 | 目标 | 当前 | 测试覆盖 |
|------|------|------|---------|
| 前端交互流畅度 | >90% | TBD | E2E测试 |
| API文档完整性 | 100% | TBD | 手动审查 |
| 用户任务完成率 | >95% | TBD | E2E测试 |

### 9.4 测试覆盖率目标

| 层级 | 目标覆盖率 | 当前覆盖率 | 差距 |
|------|----------|----------|------|
| 后端Handler | 80%+ | 0% | 🔴 需要实现 |
| 前端组件 | 70%+ | 0% | 🔴 需要实现 |
| API端点 | 100% | 0% | 🔴 需要实现 |
| 核心流程 | 100% | 0% | 🔴 需要实现 |

---

## 10. 实施时间表

### 阶段1: 基础设施 (第1周)

- ✅ 分析现有测试基础设施 (完成)
- ✅ 设计测试策略 (完成)
- 🔄 配置前端测试工具 (Jest + React Testing Library)
- 🔄 配置E2E测试工具 (Playwright)
- 🔄 创建测试数据工厂

### 阶段2: 后端测试 (第2周)

- 🔄 实现Export Center Handler单元测试
- 🔄 实现Feature Flags Handler单元测试
- 🔄 实现Notifications Handler单元测试
- 🔄 实现后端集成测试

### 阶段3: 前端测试 (第3周)

- 🔄 实现Export Center组件测试
- 🔄 实现Feature Flags组件测试
- 🔄 实现Notifications组件测试

### 阶段4: E2E测试 (第4周)

- 🔄 实现Export Center E2E测试
- 🔄 实现Feature Flags E2E测试
- 🔄 实现Notifications E2E测试
- 🔄 配置CI/CD流水线

### 阶段5: 文档和培训 (第5周)

- 🔄 创建测试运行指南
- 🔄 创建测试编写指南
- 🔄 团队培训和知识传递

---

## 11. 总结

本测试策略涵盖了后台管理系统的全栈测试方案：

**可用性保障**:
- ✅ 单元测试确保每个函数正常工作
- ✅ 集成测试确保API端到端可用
- ✅ E2E测试确保用户流程完整

**好用性保障**:
- ✅ 性能测试确保响应时间达标
- ✅ 错误处理测试确保消息友好
- ✅ 数据验证测试确保准确性

**易用性保障**:
- ✅ 前端组件测试确保交互流畅
- ✅ E2E测试模拟真实用户场景
- ✅ 完整文档确保团队易于使用

**下一步行动**:
1. 执行阶段1: 配置测试基础设施
2. 执行阶段2: 实现后端单元测试
3. 执行阶段3: 实现前端组件测试
4. 执行阶段4: 实现E2E测试
5. 执行阶段5: 文档和培训

---

**文档版本**: v1.0
**创建日期**: 2025-10-10
**作者**: Claude Code
