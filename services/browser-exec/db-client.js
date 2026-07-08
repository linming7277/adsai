/**
 * Database client for saving URL visit results
 */

import crypto from 'crypto';

class DatabaseClient {
  constructor() {
    this.pool = null;
    this.enabled = false;
  }

  async init() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.log('[db] DATABASE_URL not set, database storage disabled');
      return;
    }

    try {
      const { Pool } = await import('pg');
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: {
          rejectUnauthorized: false
        },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.enabled = true;
      console.log('[db] Database client initialized successfully');

    } catch (error) {
      console.error('[db] Failed to initialize database client:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Generate SHA256 hash of URL for grouping
   */
  hashUrl(url) {
    return crypto.createHash('sha256').update(url).digest('hex');
  }

  /**
   * Save URL visit result to database
   * @param {Object} result - Visit result from browser-exec
   * @param {Object} options - Additional options (userId, accountId, taskId, batchId)
   */
  async saveVisitResult(visitResult, options = {}) {
    if (!this.enabled) {
      return;
    }

    try {
      // Extract URL from request or result
      const sourceUrl = options.url || visitResult.metadata?.url || null;
      if (!sourceUrl) {
        console.warn('[db] No URL found in result, skipping save');
        return;
      }

      const urlHash = this.hashUrl(sourceUrl);
      const resultData = visitResult.result || {};
      const metadata = visitResult.metadata || {};
      const timings = visitResult.timings || {};

      const data = {
        user_id: options.userId || null,
        account_id: options.accountId || null,
        task_id: options.taskId || null,
        batch_id: options.batchId || null,
        source_url: sourceUrl,
        source_url_hash: urlHash,
        final_url: resultData.finalUrl || resultData.currentUrl || null,
        result_type: visitResult.success ? 'success' : 'failed',
        landing_page_type: resultData.landingPageType || null,
        brand_name: resultData.brandName || null,
        page_title: resultData.pageTitle || null,
        domain: resultData.domain || null,
        is_intermediate: resultData.isIntermediatePage || false,
        failure_reason: resultData.failureReason || null,
        error_message: visitResult.error?.message || null,
        total_duration_ms: timings.totalMs || null,
        total_bytes_transferred: resultData.bytesTransferred || null,
        redirect_count: resultData.redirectCount || 0,
        redirect_chain: resultData.redirectChain ? JSON.stringify(resultData.redirectChain) : null,
        proxy_used: metadata.proxyServer ? metadata.proxyServer.split(':')[0] : null,
        user_agent: metadata.userAgent || null,
        visit_mode: resultData.mode || metadata.mode || 'evaluate',
        cloudflare_challenge: resultData.antiDetectionResult?.solvedCloudflare || false,
        captcha_detected: resultData.captchaDetected || false,
        http_status_code: resultData.statusCode || null,
        raw_result: JSON.stringify(visitResult),
      };

      const query = `
        INSERT INTO url_visit_results (
          user_id, account_id, task_id, batch_id,
          source_url, source_url_hash, final_url,
          result_type, landing_page_type, brand_name, page_title, domain, is_intermediate,
          failure_reason, error_message,
          total_duration_ms, total_bytes_transferred, redirect_count, redirect_chain,
          proxy_used, user_agent, visit_mode,
          cloudflare_challenge, captcha_detected, http_status_code,
          raw_result
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15,
          $16, $17, $18, $19,
          $20, $21, $22,
          $23, $24, $25,
          $26
        )
      `;

      const values = [
        data.user_id, data.account_id, data.task_id, data.batch_id,
        data.source_url, data.source_url_hash, data.final_url,
        data.result_type, data.landing_page_type, data.brand_name, data.page_title, data.domain, data.is_intermediate,
        data.failure_reason, data.error_message,
        data.total_duration_ms, data.total_bytes_transferred, data.redirect_count, data.redirect_chain,
        data.proxy_used, data.user_agent, data.visit_mode,
        data.cloudflare_challenge, data.captcha_detected, data.http_status_code,
        data.raw_result
      ];

      await this.pool.query(query, values);
      console.log(`[db] Saved visit result: ${sourceUrl} -> ${visitResult.success ? 'SUCCESS' : 'FAILED'}`);

    } catch (error) {
      console.error('[db] Failed to save visit result:', error.message);
      // Don't throw - database save failure shouldn't break the main flow
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('[db] Database client closed');
    }
  }
}

// Singleton instance
export const dbClient = new DatabaseClient();
