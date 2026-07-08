#!/usr/bin/env node
/**
 * Run database migration for url_visit_results table
 * This script reads the migration SQL and executes it using pg client
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  console.log('📋 Reading migration file...');
  const migrationPath = join(__dirname, '..', '..', 'schemas', 'sql', '018_url_visit_results.sql');
  const sql = readFileSync(migrationPath, 'utf8');

  console.log('🔌 Connecting to database...');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false // Cloud SQL requires SSL
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('🚀 Executing migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  Table/view already exists, migration may have been applied previously');
    } else {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

runMigration();
