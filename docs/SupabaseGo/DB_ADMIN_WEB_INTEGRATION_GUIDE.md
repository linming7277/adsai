# db-admin Web界面集成到后台管理系统技术指南

## 🎯 集成目标

将db-admin的Web管理功能完全集成到现有的后台管理系统 (`/manage/*`) 中，提供统一的数据库管理体验，专注核心功能，避免重复造轮子。

## 🏗️ 集成架构

### 目录结构设计
```
apps/frontend/src/
├── app/
│   └── (dashboard)/
│       └── manage/
│           ├── database/
│           │   ├── overview/              # 数据库状态概览
│           │   │   └── page.tsx
│           │   ├── query/                  # SQL查询界面
│           │   │   └── page.tsx
│           │   ├── schema/                 # Schema浏览器
│           │   │   └── page.tsx
│           │   ├── migrations/             # 迁移管理
│           │   │   └── page.tsx
│           │   ├── logs/                   # 操作日志
│           │   │   └── page.tsx
│           │   └── layout.tsx              # 数据库管理专用布局
│           └── layout.tsx                  # 复用现有管理布局
├── components/
│   └── database/
│       ├── DatabaseStatusCard.tsx         # 状态卡片组件
│       ├── SqlQueryEditor.tsx             # SQL编辑器
│       ├── SchemaBrowser.tsx              # Schema浏览器
│       ├── MigrationList.tsx              # 迁移列表
│       └── OperationLogs.tsx              # 操作日志
├── lib/
│   └── api/
│       └── database.ts                    # 数据库API客户端
└── types/
    └── database.ts                         # 数据库相关类型定义
```

## 🔧 核心技术实现

### 1. API客户端封装

```typescript
// lib/api/database.ts
import { createApiClient } from './client';

export interface DatabaseStatus {
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  lastCheck: string;
  responseTime: number;
  error?: string;
}

export interface QueryResult {
  results: Array<Record<string, any>>;
  count: number;
  executionTime: string;
  success: boolean;
  service: string;
}

export interface SchemaInfo {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      defaultValue?: string;
    }>;
    indexes: Array<{
      name: string;
      columns: string[];
      unique: boolean;
    }>;
  }>;
}

export interface MigrationInfo {
  version: string;
  description: string;
  status: 'pending' | 'applied' | 'failed';
  executedAt?: string;
  error?: string;
}

export interface OperationLog {
  id: string;
  service: string;
  operation: string;
  user: string;
  timestamp: string;
  success: boolean;
  duration: number;
  details?: string;
}

class DatabaseApiClient {
  private client = createApiClient('/api/manage/database');

  // 数据库状态管理
  async getDatabaseStatus(service?: string): Promise<DatabaseStatus[]> {
    const url = service ? `/status/${service}` : '/status';
    return this.client.get(url);
  }

  async healthCheck(service: string): Promise<DatabaseStatus> {
    return this.client.get(`/health/${service}`);
  }

  // SQL查询管理
  async executeQuery(service: string, query: string): Promise<QueryResult> {
    return this.client.post(`/query/${service}`, { query });
  }

  async getQueryHistory(service: string, limit = 50): Promise<Array<{
    query: string;
    timestamp: string;
    user: string;
    duration: number;
  }>> {
    return this.client.get(`/query-history/${service}?limit=${limit}`);
  }

  // Schema管理
  async getSchema(service: string): Promise<SchemaInfo> {
    return this.client.get(`/schema/${service}`);
  }

  async getTables(service: string): Promise<string[]> {
    return this.client.get(`/tables/${service}`);
  }

  async getTableInfo(service: string, table: string): Promise<{
    columns: Array<any>;
    indexes: Array<any>;
    row_count: number;
  }> {
    return this.client.get(`/table/${service}/${table}`);
  }

  // 迁移管理
  async getMigrations(service: string): Promise<MigrationInfo[]> {
    return this.client.get(`/migrations/${service}`);
  }

  async runMigration(service: string, version: string): Promise<{
    success: boolean;
    message: string;
    executionTime: string;
  }> {
    return this.client.post(`/migrate/${service}`, { version });
  }

  async getMigrationHistory(service: string): Promise<Array<{
    version: string;
    executedAt: string;
    user: string;
    duration: number;
    success: boolean;
  }>> {
    return this.client.get(`/migration-history/${service}`);
  }

  // 操作日志
  async getOperationLogs(filters?: {
    service?: string;
    operation?: string;
    user?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<OperationLog[]> {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return this.client.get(`/logs?${params.toString()}`);
  }
}

export const databaseApi = new DatabaseApiClient();
```

### 2. 数据库状态概览页面

```typescript
// app/(dashboard)/manage/database/overview/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { DatabaseStatusCard } from '@/components/database/DatabaseStatusCard';
import { databaseApi, DatabaseStatus } from '@/lib/api/database';
import { AdminPageLayout } from '@/core/ui/PageLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/core/ui/card';
import { Badge } from '@/core/ui/badge';

export default function DatabaseOverviewPage() {
  const { data: statuses, isLoading, error } = useQuery({
    queryKey: ['database-status'],
    queryFn: () => databaseApi.getDatabaseStatus(),
    refetchInterval: 30000, // 30秒自动刷新
  });

  const healthyServices = statuses?.filter(s => s.status === 'connected').length || 0;
  const totalServices = statuses?.length || 0;
  const overallHealth = totalServices > 0 ? (healthyServices / totalServices) * 100 : 0;

  return (
    <AdminPageLayout
      title="数据库管理"
      subtitle="监控和管理所有服务的数据库状态"
    >
      <div className="space-y-6">
        {/* 整体状态概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>总体健康度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {overallHealth.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                {healthyServices}/{totalServices} 服务正常
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>服务数量</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {totalServices}
              </div>
              <p className="text-sm text-muted-foreground">
                数据库服务总数
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>最后更新</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {statuses?.[0]?.lastCheck ?
                  new Date(statuses[0].lastCheck).toLocaleString() :
                  '加载中...'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 各服务状态详情 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">服务状态</h2>
          {isLoading ? (
            <div>加载中...</div>
          ) : error ? (
            <div className="text-red-600">加载失败: {error.message}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statuses?.map((status) => (
                <DatabaseStatusCard key={status.service} status={status} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPageLayout>
  );
}

// components/database/DatabaseStatusCard.tsx
import { DatabaseStatus } from '@/lib/api/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/core/ui/card';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { RefreshCw } from 'lucide-react';

interface DatabaseStatusCardProps {
  status: DatabaseStatus;
}

export function DatabaseStatusCard({ status }: DatabaseStatusCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'disconnected': return 'bg-red-100 text-red-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return '已连接';
      case 'disconnected': return '未连接';
      case 'error': return '错误';
      default: return '未知';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{status.service}</CardTitle>
          <Badge className={getStatusColor(status.status)}>
            {getStatusText(status.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>响应时间:</span>
            <span className={status.responseTime > 1000 ? 'text-red-600' : 'text-green-600'}>
              {status.responseTime}ms
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span>最后检查:</span>
            <span>{new Date(status.lastCheck).toLocaleTimeString()}</span>
          </div>

          {status.error && (
            <div className="text-sm text-red-600 truncate" title={status.error}>
              错误: {status.error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => window.open(`/manage/database/query?service=${status.service}`, '_blank')}
            >
              查询
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => window.open(`/manage/database/schema?service=${status.service}`, '_blank')}
            >
              Schema
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. SQL查询界面

```typescript
// app/(dashboard)/manage/database/query/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { databaseApi } from '@/lib/api/database';
import { AdminPageLayout } from '@/core/ui/PageLayout';
import { SqlQueryEditor } from '@/components/database/SqlQueryEditor';
import { QueryResults } from '@/components/database/QueryResults';
import { QueryHistory } from '@/components/database/QueryHistory';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui/tabs';

export default function DatabaseQueryPage() {
  const [selectedService, setSelectedService] = useState('');
  const queryClient = useQueryClient();

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['database-services'],
    queryFn: async () => {
      const statuses = await databaseApi.getDatabaseStatus();
      return statuses.map(s => s.service);
    },
  });

  const queryMutation = useMutation({
    mutationFn: ({ service, query }: { service: string; query: string }) =>
      databaseApi.executeQuery(service, query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['query-history', selectedService] });
    },
  });

  return (
    <AdminPageLayout title="SQL查询" subtitle="执行数据库查询操作">
      <div className="space-y-6">
        {/* 服务选择 */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">选择服务:</label>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择数据库服务" />
            </SelectTrigger>
            <SelectContent>
              {services?.map(service => (
                <SelectItem key={service} value={service}>
                  {service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedService && (
          <Tabs defaultValue="editor" className="w-full">
            <TabsList>
              <TabsTrigger value="editor">查询编辑器</TabsTrigger>
              <TabsTrigger value="history">查询历史</TabsTrigger>
            </TabsList>

            <TabsContent value="editor">
              <SqlQueryEditor
                service={selectedService}
                onExecute={(query) => queryMutation.mutate({ service: selectedService, query })}
                isExecuting={queryMutation.isPending}
                result={queryMutation.data}
                error={queryMutation.error}
              />
            </TabsContent>

            <TabsContent value="history">
              <QueryHistory service={selectedService} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminPageLayout>
  );
}

// components/database/SqlQueryEditor.tsx
import { useState } from 'react';
import { Button } from '@/core/ui/button';
import { Textarea } from '@/core/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/ui/card';
import { Alert, AlertDescription } from '@/core/ui/alert';
import { Play, RotateCcw } from 'lucide-react';
import { QueryResult } from '@/lib/api/database';

interface SqlQueryEditorProps {
  service: string;
  onExecute: (query: string) => void;
  isExecuting: boolean;
  result?: QueryResult;
  error?: Error | null;
}

const SAMPLE_QUERIES = [
  'SELECT * FROM information_schema.tables WHERE table_schema = \'public\' LIMIT 10;',
  'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\';',
  'SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname = \'public\' ORDER BY tablename;',
];

export function SqlQueryEditor({ service, onExecute, isExecuting, result, error }: SqlQueryEditorProps) {
  const [query, setQuery] = useState('');

  const executeQuery = () => {
    if (query.trim()) {
      onExecute(query);
    }
  };

  const clearQuery = () => {
    setQuery('');
  };

  const loadSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
  };

  return (
    <div className="space-y-4">
      {/* 示例查询 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">示例查询</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {SAMPLE_QUERIES.map((sampleQuery, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => loadSampleQuery(sampleQuery)}
                className="text-xs h-auto py-2 px-3 whitespace-normal text-left"
              >
                {sampleQuery}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 查询编辑器 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>SQL查询 - {service}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearQuery}
                disabled={isExecuting}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                清空
              </Button>
              <Button
                onClick={executeQuery}
                disabled={!query.trim() || isExecuting}
              >
                <Play className="h-4 w-4 mr-1" />
                {isExecuting ? '执行中...' : '执行查询'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入SQL查询语句..."
            className="min-h-32 font-mono text-sm"
            disabled={isExecuting}
          />
          <div className="mt-2 text-xs text-muted-foreground">
            提示: 使用 SELECT 语句查询数据，谨慎使用 UPDATE/DELETE 等修改操作
          </div>
        </CardContent>
      </Card>

      {/* 错误信息 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            查询执行失败: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* 查询结果 */}
      {result && <QueryResults result={result} />}
    </div>
  );
}

// components/database/QueryResults.tsx
import { QueryResult } from '@/lib/api/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/ui/card';
import { Badge } from '@/core/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/core/ui/table';

interface QueryResultsProps {
  result: QueryResult;
}

export function QueryResults({ result }: QueryResultsProps) {
  const columns = result.results.length > 0 ? Object.keys(result.results[0]) : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>查询结果</CardTitle>
          <div className="flex gap-2">
            <Badge variant={result.success ? 'default' : 'destructive'}>
              {result.success ? '成功' : '失败'}
            </Badge>
            <Badge variant="outline">
              {result.count} 行
            </Badge>
            <Badge variant="outline">
              {result.executionTime}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {result.results.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            查询返回空结果
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(column => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row, index) => (
                  <TableRow key={index}>
                    {columns.map(column => (
                      <TableCell key={column}>
                        {String(row[column] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4. 后端API代理实现

```typescript
// pages/api/manage/database/[...path].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createApiProxy } from '@/lib/api/proxy';

// db-admin服务配置
const DB_ADMIN_URL = process.env.DB_ADMIN_URL || 'http://db-admin:8080';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 验证用户权限
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: '未授权访问' });
  }

  // 验证用户是否有数据库管理权限
  const user = await verifyToken(token);
  if (!user || !user.permissions.canManageDatabase) {
    return res.status(403).json({ error: '权限不足' });
  }

  // 构建目标URL
  const targetPath = req.query.path as string[];
  const targetUrl = `${DB_ADMIN_URL}/api/v1/${targetPath.join('/')}`;

  // 代理请求到db-admin服务
  return createApiProxy(req, res, targetUrl, {
    headers: {
      // 转发用户认证信息
      'Authorization': token,
      'X-User-ID': user.id,
      'X-User-Email': user.email,
    },
  });
}

// lib/api/proxy.ts
import { NextApiRequest, NextApiResponse } from 'next';

export function createApiProxy(
  req: NextApiRequest,
  res: NextApiResponse,
  targetUrl: string,
  options: {
    headers?: Record<string, string>;
  } = {}
) {
  const fetch = require('node-fetch');

  const url = new URL(targetUrl);

  // 转发查询参数
  Object.keys(req.query).forEach(key => {
    if (req.query[key] !== undefined) {
      url.searchParams.append(key, req.query[key] as string);
    }
  });

  const proxyOptions = {
    method: req.method,
    headers: {
      ...options.headers,
      'Content-Type': req.headers['content-type'] || 'application/json',
    },
  };

  // 转发请求体
  if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    proxyOptions.body = JSON.stringify(req.body);
  }

  return fetch(url.toString(), proxyOptions)
    .then(async (response: any) => {
      // 转发响应头
      Object.entries(response.headers.raw()).forEach(([key, values]) => {
        if (key.toLowerCase() !== 'content-encoding') {
          res.setHeader(key, values.join(', '));
        }
      });

      res.status(response.status);

      // 转发响应体
      const data = await response.text();
      res.send(data);
    })
    .catch((error: any) => {
      console.error('Proxy error:', error);
      res.status(502).json({
        error: '服务暂时不可用',
        details: error.message
      });
    });
}
```

### 5. 环境变量和配置

```bash
# .env.local
# db-admin服务配置
NEXT_PUBLIC_DB_ADMIN_URL=https://db-admin-prod-xxxxx-an.a.run.app
DB_ADMIN_URL=http://db-admin:8080  # 内部服务发现地址

# 权限配置
DATABASE_MANAGEMENT_ENABLED=true
```

```typescript
# lib/permissions.ts
export interface UserPermissions {
  canManageDatabase: boolean;
  canExecuteQuery: boolean;
  canRunMigrations: boolean;
  canViewLogs: boolean;
}

export function getUserDatabasePermissions(user: User): UserPermissions {
  // 管理员拥有所有权限
  if (user.role === 'admin') {
    return {
      canManageDatabase: true,
      canExecuteQuery: true,
      canRunMigrations: true,
      canViewLogs: true,
    };
  }

  // 其他角色根据需要分配权限
  return {
    canManageDatabase: false,
    canExecuteQuery: false,
    canRunMigrations: false,
    canViewLogs: false,
  };
}
```

## 📋 部署清单

### 1. 前端组件部署
- [ ] 创建数据库管理页面组件
- [ ] 实现API客户端封装
- [ ] 集成现有认证和权限系统
- [ ] 测试所有页面功能

### 2. 后端API代理部署
- [ ] 创建API代理路由
- [ ] 配置权限验证中间件
- [ ] 设置db-admin服务发现
- [ ] 测试API代理功能

### 3. 环境配置
- [ ] 配置生产环境变量
- [ ] 设置内部服务发现
- [ ] 配置CDN和缓存策略
- [ ] 设置监控和日志

### 4. 安全配置
- [ ] 验证权限控制正确性
- [ ] 配置操作审计日志
- [ ] 设置敏感操作确认
- [ ] 测试安全防护措施

## 🎯 成功指标

### 功能完整性
- [ ] 5个核心功能模块全部实现
- [ ] API代理100%覆盖db-admin接口
- [ ] 权限控制正确实施

### 用户体验
- [ ] 页面加载时间 < 2秒
- [ ] SQL查询响应时间 < 5秒
- [ ] 界面操作流畅无卡顿

### 安全性
- [ ] 所有操作都有权限验证
- [ ] 完整的操作审计日志
- [ ] 危险操作有确认提示

这个技术指南专注于核心功能的实现，避免了过度复杂的监控和告警系统，确保能够快速将db-admin的Web管理能力集成到现有的后台管理系统中。