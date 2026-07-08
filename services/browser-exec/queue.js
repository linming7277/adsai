import { randomUUID } from 'node:crypto'

let Redis
try { Redis = (await import('ioredis')).default } catch {}

export class TaskQueue {
  constructor(url) {
    this.url = url || ''
    this.isRedis = !!(this.url && Redis)
    this.running = 0
    this.processed = 0
    this.handlers = {}
    this.stopFlag = false
    this.workers = []
    // in-memory fallback
    this.memQHigh = []
    this.memQNormal = []
    this.memTasks = new Map()
    if (this.isRedis) {
      this.redis = new Redis(this.url, { lazyConnect: false, maxRetriesPerRequest: 2 })
      this.redisStatus = 'ready'
      this.redis.on('error', () => { this.redisStatus = 'error' })
    } else {
      this.redis = null
      this.redisStatus = 'disabled'
    }
    this.queueKeyHigh = 'be:q:high'
    this.queueKeyNormal = 'be:q:normal'
    this.dlqKey = 'be:dlq'
  }

  async enqueue(type, payload = {}, opts = {}) {
    const id = randomUUID()
    const priority = (opts.priority === 'high') ? 'high' : 'normal'
    const maxAttempts = Number.isFinite(opts.maxAttempts) ? Math.max(0, opts.maxAttempts|0) : 2
    const attempts = 0
    const task = { id, type, payload, status: 'queued', enqueuedAt: Date.now(), priority, attempts, maxAttempts }
    if (this.isRedis) {
      const statusKey = `be:task:${id}`
      await this.redis.hmset(statusKey, { status: 'queued', type, enqueuedAt: String(task.enqueuedAt), attempts: String(attempts), maxAttempts: String(maxAttempts), priority })
      const key = priority === 'high' ? this.queueKeyHigh : this.queueKeyNormal
      await this.redis.rpush(key, JSON.stringify(task))
    } else {
      this.memTasks.set(id, { status: 'queued', type, enqueuedAt: task.enqueuedAt, attempts, maxAttempts, priority })
      ;(priority === 'high' ? this.memQHigh : this.memQNormal).push(task)
    }
    return id
  }

  async getTask(id) {
    if (this.isRedis) {
      const statusKey = `be:task:${id}`
      const h = await this.redis.hgetall(statusKey)
      if (!h || !h.status) return null
      const out = { id, status: h.status, type: h.type, enqueuedAt: Number(h.enqueuedAt||0), attempts: Number(h.attempts||0), maxAttempts: Number(h.maxAttempts||0), priority: h.priority }
      if (h.result) { try { out.result = JSON.parse(h.result) } catch { out.result = h.result } }
      if (h.error) out.error = h.error
      return out
    }
    const st = this.memTasks.get(id)
    if (!st) return null
    return { id, ...st }
  }

  async stats() {
    let hi = 0, lo = 0, dlq = 0
    if (this.isRedis) {
      ;[hi, lo, dlq] = await Promise.all([
        this.redis.llen(this.queueKeyHigh),
        this.redis.llen(this.queueKeyNormal),
        this.redis.llen(this.dlqKey),
      ])
    } else {
      hi = this.memQHigh.length; lo = this.memQNormal.length; dlq = 0
    }
    return { queueLength: hi + lo, high: hi, normal: lo, deadletters: dlq, running: this.running, processed: this.processed, backend: this.isRedis ? 'redis' : 'memory', redis: this.redisStatus }
  }

  async setConcurrency(n) {
    const target = Math.max(1, Math.min(256, n|0))
    const cur = this.workers.length
    if (target === cur) return cur
    if (target > cur) {
      const add = target - cur
      for (let i=0;i<add;i++) this._spawnOne()
    } else {
      const stop = cur - target
      for (let i=0;i<stop;i++) {
        const w = this.workers.pop()
        if (w) w.stop()
      }
    }
    return this.workers.length
  }

  registerHandlers(map) {
    this.handlers = { ...map }
  }

  start(initial = 1) {
    this.stopFlag = false
    this.setConcurrency(initial)
  }

  stop() {
    this.stopFlag = true
    for (const w of this.workers) w.stop()
    this.workers = []
  }

  _spawnOne() {
    const self = this
    let stopped = false
    const worker = {
      stop() { stopped = true },
    }
    this.workers.push(worker)
    ;(async function runloop() {
      while (!self.stopFlag && !stopped) {
        let task = null
        try {
          if (self.isRedis) {
            const item = await self.redis.blpop(self.queueKeyHigh, self.queueKeyNormal, 1)
            if (item && item[1]) task = JSON.parse(item[1])
          } else {
            task = self.memQHigh.shift() || self.memQNormal.shift()
            if (!task) { await new Promise(r => setTimeout(r, 200)); continue }
          }
          if (!task) continue
          const { id, type, payload } = task
          self.running++
          await self._markRunning(id, type)
          try {
            const fn = self.handlers[type]
            if (!fn) throw new Error(`NO_HANDLER:${type}`)
            const result = await fn(payload)
            self.processed++
            await self._markCompleted(id, type, result)
          } catch (e) {
            const retried = await self._retryOrDeadletter(task, String(e?.message || e))
            if (!retried) {
              await self._markFailed(id, type, String(e?.message || e))
            }
          } finally {
            self.running = Math.max(0, self.running - 1)
          }
        } catch (e) {
          await new Promise(r => setTimeout(r, 200))
        }
      }
    })()
  }

  async _markRunning(id, type) {
    if (this.isRedis) {
      await this.redis.hmset(`be:task:${id}`, { status: 'running', type })
    } else {
      const cur = this.memTasks.get(id) || {}
      this.memTasks.set(id, { ...cur, status: 'running', type })
    }
  }
  async _markCompleted(id, type, result) {
    const resultStr = JSON.stringify(result||{})
    if (this.isRedis) {
      await this.redis.hmset(`be:task:${id}`, { status: 'completed', type, result: resultStr })
    } else {
      const cur = this.memTasks.get(id) || {}
      this.memTasks.set(id, { ...cur, status: 'completed', type, result: JSON.parse(resultStr) })
    }
  }
  async _markFailed(id, type, error) {
    if (this.isRedis) {
      await this.redis.hmset(`be:task:${id}`, { status: 'failed', type, error })
    } else {
      const cur = this.memTasks.get(id) || {}
      this.memTasks.set(id, { ...cur, status: 'failed', type, error })
    }
  }

  async _retryOrDeadletter(task, error) {
    const { id } = task
    let attempts = Number(task.attempts || 0)
    const maxAttempts = Number(task.maxAttempts || 0)
    attempts++
    if (attempts <= maxAttempts) {
      const t2 = { ...task, attempts, status: 'queued' }
      if (this.isRedis) {
        await this.redis.hmset(`be:task:${id}`, { attempts: String(attempts), status: 'queued' })
        await this.redis.rpush(this.queueKeyNormal, JSON.stringify(t2))
      } else {
        const cur = this.memTasks.get(id) || {}
        this.memTasks.set(id, { ...cur, attempts, status: 'queued' })
        this.memQNormal.push(t2)
      }
      return true
    }
    // DLQ (redis only; memory fallback keeps status=failed)
    if (this.isRedis) {
      await this.redis.hmset(`be:task:${id}`, { status: 'failed', error })
      await this.redis.rpush(this.dlqKey, JSON.stringify({ id, type: task.type, error, at: Date.now(), payload: task.payload }))
    }
    return false
  }
}
