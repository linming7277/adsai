# Firebase Authentication 监控和告警配置

## 概述
本文档描述了 Firebase Authentication 的监控指标和告警配置,使用 Google Cloud Monitoring 实现。

---

## 监控指标

### 1. 登录成功率 (Login Success Rate)
**指标名称**: `auth_event`
**过滤条件**: `eventType = "login_success"`
**聚合方式**: 计数 (Count)
**时间窗口**: 1 分钟
**目标**: > 95% 成功率

**查询语句**:
```
resource.type="cloud_run_revision"
resource.labels.service_name="frontend-preview"
jsonPayload.metric="auth_event"
jsonPayload.eventType="login_success"
```

---

### 2. 登录失败率 (Login Failure Rate)
**指标名称**: `auth_event`
**过滤条件**: `eventType = "login_failure"`
**聚合方式**: 计数 (Count)
**时间窗口**: 1 分钟
**告警阈值**: > 10 次/分钟

**查询语句**:
```
resource.type="cloud_run_revision"
resource.labels.service_name="frontend-preview"
jsonPayload.metric="auth_event"
jsonPayload.eventType="login_failure"
```

---

### 3. 速率限制触发次数 (Rate Limit Exceeded)
**指标名称**: `auth_event`
**过滤条件**: `eventType = "login_rate_limit_exceeded"`
**聚合方式**: 计数 (Count)
**时间窗口**: 5 分钟
**告警阈值**: > 50 次/5 分钟

**查询语句**:
```
resource.type="cloud_run_revision"
resource.labels.service_name="frontend-preview"
jsonPayload.metric="auth_event"
jsonPayload.eventType="login_rate_limit_exceeded"
```

**按限制类型分组**:
```
jsonPayload.limitType="ip"     # IP 级别限制
jsonPayload.limitType="user"   # 用户级别限制
jsonPayload.limitType="global" # 全局级别限制
```

---

### 4. 自动创建用户成功/失败
**成功**:
```
resource.type="cloud_run_revision"
jsonPayload.message:"Successfully auto-created user and organization"
```

**失败**:
```
resource.type="cloud_run_revision"
jsonPayload.message:"Failed to auto-create user and organization"
```

---

## 告警策略配置

### 告警 1: 登录失败率过高
**名称**: `auth-login-failure-rate-high`
**条件**: 登录失败次数 > 10 次/分钟 持续 3 分钟
**严重性**: Warning
**通知渠道**: Email, Slack (可选)

**创建命令** (使用 gcloud):
```bash
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Auth: High Login Failure Rate" \
  --condition-display-name="Login failures > 10/min" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=180s \
  --condition-filter='
    resource.type="cloud_run_revision"
    AND resource.labels.service_name="frontend-preview"
    AND jsonPayload.metric="auth_event"
    AND jsonPayload.eventType="login_failure"
  ' \
  --aggregation-period=60s \
  --aggregation-per-series-aligner=ALIGN_RATE \
  --aggregation-cross-series-reducer=REDUCE_SUM
```

---

### 告警 2: 速率限制频繁触发
**名称**: `auth-rate-limit-frequent`
**条件**: 速率限制触发 > 50 次/5 分钟
**严重性**: Warning
**通知渠道**: Email, Slack

**创建命令**:
```bash
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Auth: Frequent Rate Limiting" \
  --condition-display-name="Rate limit triggers > 50/5min" \
  --condition-threshold-value=50 \
  --condition-threshold-duration=300s \
  --condition-filter='
    resource.type="cloud_run_revision"
    AND resource.labels.service_name="frontend-preview"
    AND jsonPayload.metric="auth_event"
    AND jsonPayload.eventType="login_rate_limit_exceeded"
  ' \
  --aggregation-period=300s \
  --aggregation-per-series-aligner=ALIGN_SUM \
  --aggregation-cross-series-reducer=REDUCE_SUM
```

---

### 告警 3: 用户自动创建失败
**名称**: `auth-user-creation-failed`
**条件**: 自动创建用户失败 > 1 次
**严重性**: Error
**通知渠道**: Email, PagerDuty (可选)

**创建命令**:
```bash
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Auth: User Auto-creation Failed" \
  --condition-display-name="User creation failures detected" \
  --condition-threshold-value=1 \
  --condition-threshold-duration=60s \
  --condition-filter='
    resource.type="cloud_run_revision"
    AND resource.labels.service_name="frontend-preview"
    AND jsonPayload.message:"Failed to auto-create user and organization"
  ' \
  --aggregation-period=60s \
  --aggregation-per-series-aligner=ALIGN_SUM \
  --aggregation-cross-series-reducer=REDUCE_SUM
```

---

### 告警 4: 登录成功率下降
**名称**: `auth-login-success-rate-low`
**条件**: 登录成功率 < 80% (计算方式: 成功次数 / (成功次数 + 失败次数))
**严重性**: Warning
**通知渠道**: Email, Slack

**注意**: 需要创建基于日志的指标 (Log-based Metrics)

---

## 创建日志指标 (Log-based Metrics)

### 步骤 1: 创建登录成功指标
```bash
gcloud logging metrics create auth_login_success \
  --description="Count of successful logins" \
  --log-filter='
    resource.type="cloud_run_revision"
    AND resource.labels.service_name="frontend-preview"
    AND jsonPayload.metric="auth_event"
    AND jsonPayload.eventType="login_success"
  '
```

### 步骤 2: 创建登录失败指标
```bash
gcloud logging metrics create auth_login_failure \
  --description="Count of failed logins" \
  --log-filter='
    resource.type="cloud_run_revision"
    AND resource.labels.service_name="frontend-preview"
    AND jsonPayload.metric="auth_event"
    AND jsonPayload.eventType="login_failure"
  '
```

### 步骤 3: 创建速率限制触发指标
```bash
gcloud logging metrics create auth_rate_limit_exceeded \
  --description="Count of rate limit triggers" \
  --log-filter='
    resource.type="cloud_run_revision"
    AND resource.labels.service_name="frontend-preview"
    AND jsonPayload.metric="auth_event"
    AND jsonPayload.eventType="login_rate_limit_exceeded"
  '
```

---

## Dashboard 配置

### 创建 Cloud Monitoring Dashboard

**Dashboard 名称**: `Firebase Authentication Monitoring`

**面板 (Panels)**:

1. **登录成功/失败趋势 (时序图)**
   - 指标: `auth_login_success`, `auth_login_failure`
   - 时间范围: 1 小时
   - 图表类型: 折线图

2. **登录成功率 (百分比)**
   - 计算: `auth_login_success / (auth_login_success + auth_login_failure) * 100`
   - 图表类型: 仪表盘 (Gauge)
   - 目标: > 95%

3. **速率限制触发次数 (按类型分组)**
   - 指标: `auth_rate_limit_exceeded`
   - 分组: `limitType` (ip, user, global)
   - 图表类型: 堆叠柱状图

4. **用户自动创建统计**
   - 成功/失败次数
   - 图表类型: 计数器

**创建 Dashboard** (通过 Terraform):
```hcl
resource "google_monitoring_dashboard" "auth_dashboard" {
  dashboard_json = jsonencode({
    displayName = "Firebase Authentication Monitoring"
    mosaicLayout = {
      columns = 12
      tiles = [
        # 登录成功/失败趋势
        {
          width = 6
          height = 4
          widget = {
            title = "Login Success/Failure Trend"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"logging.googleapis.com/user/auth_login_success\""
                      aggregation = {
                        alignmentPeriod = "60s"
                        perSeriesAligner = "ALIGN_RATE"
                      }
                    }
                  }
                  plotType = "LINE"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"logging.googleapis.com/user/auth_login_failure\""
                      aggregation = {
                        alignmentPeriod = "60s"
                        perSeriesAligner = "ALIGN_RATE"
                      }
                    }
                  }
                  plotType = "LINE"
                }
              ]
            }
          }
        },
        # ... more tiles
      ]
    }
  })
}
```

---

## 手动查询示例

### Cloud Console Logs Explorer

**查看最近 100 次登录失败**:
```
resource.type="cloud_run_revision"
resource.labels.service_name="frontend-preview"
jsonPayload.metric="auth_event"
jsonPayload.eventType="login_failure"
```

**查看特定用户的登录历史**:
```
resource.type="cloud_run_revision"
jsonPayload.metric="auth_event"
jsonPayload.userId="USER_ID_HERE"
```

**查看特定 IP 的速率限制记录**:
```
resource.type="cloud_run_revision"
jsonPayload.metric="auth_event"
jsonPayload.eventType="login_rate_limit_exceeded"
jsonPayload.ip="IP_ADDRESS_HERE"
```

---

## 维护建议

1. **定期审查告警策略** (每季度)
   - 调整阈值根据实际流量
   - 移除不必要的告警

2. **监控指标保留期**
   - 默认保留 30 天
   - 考虑导出到 BigQuery 长期存储

3. **通知渠道测试**
   - 每月测试告警通知
   - 确保联系人信息最新

4. **Dashboard 共享**
   - 团队成员访问权限
   - 只读 vs 编辑权限

---

## 故障排查

### 问题: 告警没有触发
**检查项**:
1. 日志是否正确输出 (检查结构化日志格式)
2. 日志过滤器是否正确
3. 告警策略是否启用
4. 通知渠道是否正确配置

### 问题: 误报过多
**解决方案**:
1. 调整阈值 (增加触发次数或延长持续时间)
2. 添加更精确的过滤条件
3. 使用聚合函数平滑数据

---

**创建日期**: 2025-10-02
**维护者**: DevOps Team
**版本**: 1.0
