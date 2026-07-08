/**
 * Pub/Sub Queue Manager - 访问请求队列
 *
 * 解决Cloud Run速率限制问题:
 * - 客户端发送100个请求到Pub/Sub → 不会触发速率限制
 * - Pub/Sub以可控速率分发给worker → 平滑处理
 * - 保证每个请求都被处理 → 消息持久化
 */

import { PubSub } from '@google-cloud/pubsub'

const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID || 'your-gcp-project-id'
})

const TOPIC_NAME = 'browser-visit-requests'
const SUBSCRIPTION_NAME = 'browser-visit-workers'

class QueueManager {
  constructor() {
    this.topic = pubsub.topic(TOPIC_NAME)
    this.subscription = null
    this.isProcessing = false
    this.stats = {
      published: 0,
      processed: 0,
      failed: 0,
      inProgress: 0
    }
  }

  /**
   * 发布访问请求到队列
   */
  async publishVisitRequest(request) {
    try {
      const messageId = await this.topic.publishMessage({
        json: {
          ...request,
          publishedAt: Date.now()
        }
      })

      this.stats.published++
      console.log(`[pubsub] Published request to queue: ${messageId}`)

      return { success: true, messageId }
    } catch (error) {
      console.error('[pubsub] Publish failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 启动消息处理worker
   */
  async startWorker(processFn, options = {}) {
    if (this.isProcessing) {
      console.log('[pubsub] Worker already running')
      return
    }

    const {
      maxMessages = 10,          // 同时处理10条消息
      maxExtension = 600000       // 消息处理超时10分钟
    } = options

    this.subscription = pubsub.subscription(SUBSCRIPTION_NAME, {
      flowControl: {
        maxMessages,              // 控制并发数
        maxExtension
      }
    })

    console.log(`[pubsub] Starting worker (maxMessages: ${maxMessages})`)
    this.isProcessing = true

    this.subscription.on('message', async (message) => {
      this.stats.inProgress++
      const startTime = Date.now()

      try {
        // Parse message data - Pub/Sub sends data as Buffer
        const request = JSON.parse(message.data.toString())
        console.log(`[pubsub] Processing message ${message.id}: ${request.url}`)

        // 调用处理函数
        const result = await processFn(request)

        // ✅ 关键修复: 只要消息被成功取出并处理完毕,就应该 ack
        // 无论访问结果如何,消息处理流程已完成,不应该重试
        message.ack()

        if (result.success) {
          this.stats.processed++
          console.log(`[pubsub] Message ${message.id} processed successfully - URL访问成功 (${Date.now() - startTime}ms)`)
        } else {
          this.stats.failed++
          console.log(`[pubsub] Message ${message.id} processed successfully - URL访问失败 (${Date.now() - startTime}ms)`)
          // 修复: 正确序列化错误对象
          const failureReason = result.failureReason
            || (result.error && typeof result.error === 'object' ? JSON.stringify(result.error) : result.error)
            || 'Unknown'
          console.log(`[pubsub]   失败原因: ${failureReason}`)
          // 注意: 这里是 URL 访问失败,不是消息处理失败,所以仍然 ack
          // URL 访问失败的结果会被记录到日志或数据库中,供后续分析
        }
      } catch (error) {
        // ❌ 只有在消息解析失败、代码异常等系统级错误时才 nack
        this.stats.failed++
        message.nack()
        console.error(`[pubsub] Message ${message.id} 系统错误 (将重试):`, error.message)
      } finally {
        this.stats.inProgress--
      }
    })

    this.subscription.on('error', (error) => {
      console.error('[pubsub] Subscription error:', error)
    })
  }

  /**
   * 停止worker
   */
  async stopWorker() {
    if (this.subscription) {
      await this.subscription.close()
      this.subscription = null
      this.isProcessing = false
      console.log('[pubsub] Worker stopped')
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.processed > 0
        ? `${(this.stats.processed / (this.stats.processed + this.stats.failed) * 100).toFixed(1)}%`
        : '0%'
    }
  }
}

// 导出单例
export const queueManager = new QueueManager()
