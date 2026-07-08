# db-admin服务集成到后台管理系统方案

## 🎯 核心目标

1. **将db-admin的Web管理界面集成到现有后台管理系统**
2. **专注核心数据库管理功能，移除非必要的高级功能**
3. **提供统一的管理体验，复用现有认证和权限系统**

## 🏗️ 集成架构设计

### 路由集成方案
```typescript
// 现有后台管理系统路由结构
/manage
├── dashboard           // 现有仪表板
├── users              // 用户管理
├── billing            // 计费管理
└── database           // ← 新增数据库管理模块
    ├── overview       // 数据库状态概览
    ├── query          // SQL查询界面
    ├── schema         // Schema浏览器
    ├── migrations     // 迁移管理
    └── logs           // 操作日志
```

### 组件集成架构
```typescript
// 集成到现有AdminPageLayout中
const DatabaseManagement = () => {
  return (
    <AdminPageLayout>
      <DatabaseOverview />        // 数据库状态仪表板
      <SqlQueryInterface />       // SQL查询界面
      <SchemaBrowser />           // Schema浏览器
      <MigrationManager />        // 迁移管理
      <OperationLogs />           // 操作日志
    </AdminPageLayout>
  );
};
```

## 🔧 核心功能模块

### 1. 数据库状态概览 (`/manage/database/overview`)
**功能**：
- 显示所有服务的数据库连接状态
- 实时健康检查结果
- 基础性能指标

**数据来源**：db-admin API `/api/v1/databases/{service}/status`

```typescript
interface DatabaseStatus {
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  lastCheck: string;
  responseTime: number;
  error?: string;
}
```

### 2. SQL查询界面 (`/manage/database/query`)
**功能**：
- SQL编辑器和执行器
- 查询结果展示
- 查询历史记录

**安全特性**：
- 继承现有管理系统的权限控制
- 查询操作审计日志
- 危险操作确认提示

**API集成**：
- `POST /api/v1/databases/{service}/query` - 执行查询
- `GET /api/v1/databases/{service}/query-history` - 查询历史

### 3. Schema浏览器 (`/manage/database/schema`)
**功能**：
- 可视化数据库结构
- 表和索引信息展示
- 字段类型和约束详情

**API集成**：
- `GET /api/v1/databases/{service}/schema` - 获取完整Schema
- `GET /api/v1/databases/{service}/tables` - 获取表列表
- `GET /api/v1/databases/{service}/indexes` - 获取索引信息

### 4. 迁移管理 (`/manage/database/migrations`)
**功能**：
- 迁移文件列表和状态
- 执行迁移操作
- 迁移历史记录

**API集成**：
- `GET /api/v1/databases/{service}/migrations` - 获取迁移列表
- `POST /api/v1/databases/{service}/migrate` - 执行迁移
- `GET /api/v1/databases/{service}/migration-history` - 迁移历史

### 5. 操作日志 (`/manage/database/logs`)
**功能**：
- 数据库操作审计日志
- 错误日志查看
- 操作统计信息

**API集成**：
- `GET /api/v1/audit-logs` - 获取审计日志
- `GET /api/v1/error-logs` - 获取错误日志

## 🔐 权限和安全集成

### 现有权限系统复用
```typescript
// 复用现有的用户权限系统
interface UserPermission {
  canManageDatabase: boolean;   // 数据库管理权限
  canExecuteQuery: boolean;     // SQL查询权限
  canRunMigrations: boolean;    // 迁移执行权限
  canViewLogs: boolean;         // 日志查看权限
}

// 权限检查组件
const ProtectedDatabaseFeature = ({
  permission,
  children
}: {
  permission: keyof UserPermission;
  children: React.ReactNode;
}) => {
  if (!userPermissions[permission]) {
    return <AccessDenied />;
  }
  return <>{children}</>;
};
```

### JWT认证集成
```typescript
// 使用现有的认证系统
const dbAdminClient = new DBAdminClient({
  baseURL: process.env.DB_ADMIN_URL,
  token: userAuthToken, // 使用现有的用户JWT Token
});
```

## 📱 UI组件设计

### 1. 数据库状态卡片
```typescript
const DatabaseStatusCard = ({ service, status }: DatabaseStatus) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{service} 数据库</CardTitle>
        <StatusBadge status={status.status} />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>状态:</span>
            <span className={getStatusColor(status.status)}>
              {status.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span>响应时间:</span>
            <span>{status.responseTime}ms</span>
          </div>
          <div className="flex justify-between">
            <span>最后检查:</span>
            <span>{formatTime(status.lastCheck)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

### 2. SQL查询编辑器
```typescript
const SqlQueryEditor = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const executeQuery = async () => {
    setLoading(true);
    try {
      const response = await dbAdminClient.query(selectedService, query);
      setResults(response.data);
    } catch (error) {
      toast.error('查询执行失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={selectedService} onValueChange={setSelectedService}>
          <SelectTrigger>
            <SelectValue placeholder="选择服务" />
          </SelectTrigger>
          <SelectContent>
            {services.map(service => (
              <SelectItem key={service} value={service}>
                {service}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={executeQuery} disabled={loading}>
          {loading ? '执行中...' : '执行查询'}
        </Button>
      </div>

      <Textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="输入SQL查询..."
        className="min-h-32"
      />

      {results && (
        <QueryResults results={results} />
      )}
    </div>
  );
};
```

### 3. 迁移管理界面
```typescript
const MigrationManager = () => {
  const [migrations, setMigrations] = useState([]);
  const [selectedService, setSelectedService] = useState('');

  const loadMigrations = async () => {
    try {
      const response = await dbAdminClient.getMigrations(selectedService);
      setMigrations(response.data);
    } catch (error) {
      toast.error('加载迁移列表失败: ' + error.message);
    }
  };

  const runMigration = async (version: string) => {
    try {
      await dbAdminClient.runMigration(selectedService, version);
      toast.success('迁移执行成功');
      loadMigrations(); // 重新加载
    } catch (error) {
      toast.error('迁移执行失败: ' + error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={selectedService} onValueChange={setSelectedService}>
          <SelectTrigger>
            <SelectValue placeholder="选择服务" />
          </SelectTrigger>
          <SelectContent>
            {services.map(service => (
              <SelectItem key={service} value={service}>
                {service}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={loadMigrations}>加载迁移</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>版本</TableHead>
            <TableHead>描述</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>执行时间</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {migrations.map(migration => (
            <TableRow key={migration.version}>
              <TableCell>{migration.version}</TableCell>
              <TableCell>{migration.description}</TableCell>
              <TableCell>
                <Badge variant={migration.status === 'applied' ? 'default' : 'secondary'}>
                  {migration.status}
                </Badge>
              </TableCell>
              <TableCell>{formatTime(migration.executedAt)}</TableCell>
              <TableCell>
                {migration.status !== 'applied' && (
                  <Button
                    size="sm"
                    onClick={() => runMigration(migration.version)}
                  >
                    执行
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
```

## 🔌 后端API集成

### 1. API代理层
```typescript
// 在现有后台管理API中添加db-admin代理
app.use('/api/manage/database', createProxyMiddleware({
  target: process.env.DB_ADMIN_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/manage/database': '/api/v1',
  },
  onProxyReq: (proxyReq, req, res) => {
    // 添加用户认证Token
    const token = req.headers.authorization;
    if (token) {
      proxyReq.setHeader('Authorization', token);
    }
  },
}));
```

### 2. 环境变量配置
```bash
# 后台管理系统环境变量
NEXT_PUBLIC_DB_ADMIN_URL=https://db-admin-prod-xxxxx-an.a.run.app
DB_ADMIN_INTERNAL_URL=http://db-admin:8080  # 内部服务发现
```

## 📋 实施计划

### Phase 1: 基础集成 (1周)
1. **路由和页面结构**
   - 添加数据库管理路由到后台管理系统
   - 创建基础页面组件结构
   - 集成现有的AdminPageLayout

2. **认证和权限**
   - 复用现有JWT认证系统
   - 配置数据库管理权限控制
   - 实现API代理层

### Phase 2: 核心功能 (1周)
1. **数据库状态概览**
   - 实现数据库连接状态展示
   - 添加基础健康检查功能
   - 创建状态监控仪表板

2. **SQL查询界面**
   - 集成SQL编辑器组件
   - 实现查询结果展示
   - 添加查询历史功能

### Phase 3: 高级功能 (1周)
1. **Schema浏览器**
   - 实现表结构可视化
   - 添加索引信息展示
   - 创建Schema搜索功能

2. **迁移管理**
   - 集成迁移列表和状态
   - 实现迁移执行功能
   - 添加迁移历史记录

### Phase 4: 完善和优化 (1周)
1. **操作日志**
   - 实现审计日志查看
   - 添加操作统计功能
   - 创建日志搜索和过滤

2. **用户体验优化**
   - 添加加载状态和错误处理
   - 优化响应式设计
   - 完善用户指导

## 🎯 成功指标

### 功能完整性
- [ ] 5个核心功能模块全部实现
- [ ] 100%复用现有认证和权限系统
- [ ] 所有db-admin API正确集成

### 用户体验
- [ ] 页面加载时间 < 2秒
- [ ] SQL查询响应时间 < 5秒
- [ ] 界面操作流畅，无明显卡顿

### 安全性
- [ ] 所有操作都有权限验证
- [ ] 完整的操作审计日志
- [ ] 危险操作有确认提示

## 🔧 技术栈

### 前端
- **框架**: Next.js 14 (与现有系统一致)
- **UI组件**: Tailwind CSS + shadcn/ui (与现有系统一致)
- **状态管理**: React Query (用于API数据管理)
- **代码编辑器**: Monaco Editor (VS Code编辑器内核)

### 后端
- **API代理**: Next.js API Routes
- **认证**: 复用现有JWT系统
- **权限**: 集成现有RBAC系统

### 部署
- **环境**: 与现有后台管理系统一同部署
- **域名**: https://www.autoads.dev/manage/database
- **CDN**: 与现有系统共享CDN配置

这个集成方案专注于核心数据库管理功能，避免了过度复杂的监控和告警系统，同时充分利用了现有的后台管理基础设施，确保了一致的用户体验和安全性。