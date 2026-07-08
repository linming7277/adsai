# 新用户Onboarding系统快速参考

## ⚡ 快速测试

### 最简单的验证方法

1. **打开隐私模式浏览器**
2. **访问**: https://www.urlchecker.dev/auth
3. **使用全新的Google账号登录**
4. **等待10秒**
5. **检查以下页面**:

```
✅ /offers          → 应该看到 8 个Demo Offers（不是空列表）
✅ /settings/tokens → Token余额显示 1000（不是0）
✅ /settings/checkin → 签到功能可用（不是错误）
✅ /settings/referral → 显示8位邀请码（不是错误）
✅ 通知图标         → 有欢迎通知
```

## 🎯 系统流程

```
新用户Google登录
    ↓
OAuth回调 (/auth/callback)
    ↓
检测到新用户（创建时间<10秒）
    ↓
创建Trial订阅（7天，1000 tokens）
    ↓
触发Onboarding Handler（异步，3-5秒）
    ↓
初始化完成：
  ├─ 8个Demo Offers
  ├─ 欢迎通知
  ├─ 签到系统
  └─ 邀请码
```

## 📊 预期数据

### Demo Offers (8个)
```
1. Nike Summer Sale        - scaling    - $250K - ROAS 4.2
2. Amazon Prime Day        - scaling    - $180K - ROAS 3.8
3. Apple iPhone 15         - scaling    - $320K - ROAS 5.1
4. Adidas Fall Collection  - optimizing - $0    - 待评估
5. Samsung Galaxy          - optimizing - $0    - 待评估
6. Sony PlayStation        - evaluating - $0    - 评估中
7. Microsoft Surface       - evaluating - $0    - 失败
8. Dell Laptop (Archived)  - archived   - $150K - ROAS 3.2
```

### Token交易
```
类型: Credit
金额: +1000
描述: Trial subscription created
```

### 签到统计
```
连续签到: 0天
本月签到: 0次
总tokens: 0
```

### 邀请码
```
格式: 8位随机字符 (例如: a3b5c7d9)
状态: pending
```

## 🔧 关键配置

### 服务URL
```bash
OFFER_SERVICE_URL=https://offer-preview-yt54xvsg5q-an.a.run.app
USERACTIVITY_SERVICE_URL=https://useractivity-preview-yt54xvsg5q-an.a.run.app
```

### 当前版本
```
billing-preview-00047-t5f  (deployed 2025-10-18 09:24:55 UTC)
```

## 🚨 常见问题

### Q: Offers页面是空的？
**A**: 等待10秒再刷新，Onboarding是异步的

### Q: Token余额显示0？
**A**: 检查Trial订阅是否创建成功，查看 /settings/subscription

### Q: 签到显示错误？
**A**: 检查数据库 user_checkin_stats 表是否有记录

### Q: 没有邀请码？
**A**: 检查数据库 referrals 表，确认记录已创建

## 📝 快速日志检查

```bash
# 查看最近onboarding活动
gcloud logging read \
  'resource.labels.service_name="billing-preview" AND jsonPayload.message=~"Onboarding"' \
  --limit 10 --freshness=1h

# 查看demo创建日志
gcloud logging read \
  'resource.labels.service_name="offer-preview" AND jsonPayload.message=~"demo"' \
  --limit 10 --freshness=1h
```

## ✅ 完美结果检查清单

- [ ] OAuth登录顺利
- [ ] Dashboard有数据（不是全0）
- [ ] Offers页面显示8个demo
- [ ] Token余额1000
- [ ] 签到功能可点击
- [ ] 邀请码已生成
- [ ] 有欢迎通知
- [ ] Trial订阅显示7天到期

**8/8通过** = 系统完美运行 🎉

## 📚 详细文档

- **完整实现**: `NEW_USER_ONBOARDING_IMPLEMENTATION.md`
- **验证指南**: `ONBOARDING_VERIFICATION_GUIDE.md`
- **手动测试**: `ONBOARDING_MANUAL_TEST_GUIDE.md`

---

**部署时间**: 2025-10-18 09:24:55 UTC
**状态**: ✅ Production Ready
