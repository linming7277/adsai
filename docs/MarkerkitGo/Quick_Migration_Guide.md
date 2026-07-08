# Guía Rápida de Migración de Base de Datos

## Estado Actual

**Archivos de migración pendientes:**
- ✅ `024_add_missing_ai_fields.sql` - Campos AI para evaluaciones v2.5.0
- ✅ `025_evaluation_trends.sql` - Vistas y funciones de tendencias
- ✅ `026_daily_checkin.sql` - Sistema de check-in diario

**Código backend implementado:**
- ✅ Daily checkin API endpoints en `services/billing/cmd/server/main.go`
- ✅ Token balance con estadísticas (today/month consumed, pending tasks)
- ✅ Frontend Phase 6 completado (Token management UI)

---

## Método 1: Cloud Run Job (Recomendado para producción)

### Ejecutar las migraciones

```bash
# Desde el directorio raíz del proyecto
gcloud builds submit --config scripts/cloudbuild-migrate.yaml . --timeout=20m
```

Este comando:
1. Construye la imagen Docker con el migration runner
2. Crea/actualiza el Cloud Run Job `db-migrate`
3. Ejecuta las 3 migraciones en orden automáticamente
4. Usa VPC connector para conectar con Cloud SQL

### Verificar la ejecución

```bash
# Ver logs del job
gcloud run jobs executions list --job=db-migrate --region=asia-northeast1 --limit=1
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=db-migrate" \
  --limit=100 --format=json
```

---

## Método 2: Ejecución Manual (Desarrollo)

### Opción A: Usando Cloud SQL Proxy

```bash
# 1. Iniciar Cloud SQL Proxy
cloud_sql_proxy -instances=gen-lang-client-0944935873:asia-northeast1:autoads=tcp:5432

# 2. En otra terminal, ejecutar migraciones
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/autoads_db"

psql $DATABASE_URL -f schemas/sql/024_add_missing_ai_fields.sql
psql $DATABASE_URL -f schemas/sql/025_evaluation_trends.sql
psql $DATABASE_URL -f schemas/sql/026_daily_checkin.sql
```

### Opción B: Usando gcloud (requiere psql instalado)

```bash
# Ejecutar cada migración
gcloud sql connect autoads --user=postgres --quiet --database=autoads_db \
  < schemas/sql/024_add_missing_ai_fields.sql

gcloud sql connect autoads --user=postgres --quiet --database=autoads_db \
  < schemas/sql/025_evaluation_trends.sql

gcloud sql connect autoads --user=postgres --quiet --database=autoads_db \
  < schemas/sql/026_daily_checkin.sql
```

---

## Método 3: Ejecutar desde local con Go

```bash
# Compilar y ejecutar el migration runner
export DATABASE_URL="postgresql://postgres:PASSWORD@CLOUD_SQL_IP:5432/autoads_db"
export PROJECT_ROOT=$PWD

cd scripts
go run run-migrations.go
```

---

## Verificación Post-Migración

### Verificar Migración 024 (AI Fields)

```sql
-- Conectar a la base de datos
\c autoads_db

-- Verificar nuevos campos en offer_evaluations
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'offer_evaluations'
  AND column_name LIKE 'ai_%'
ORDER BY column_name;

-- Debe mostrar:
-- ai_budget_recommendation (jsonb)
-- ai_competitor_insights (jsonb)
-- ai_conversion_insights (jsonb)
-- ai_geography_insights (jsonb)
-- ai_ltv_insights (jsonb)
-- ai_profitability_insights (jsonb)
-- ai_product_insights (jsonb)
-- ai_recommendation_score (integer)
-- ai_risk_assessment (jsonb)
-- ai_search_intent_insights (jsonb)
-- ai_seasonality_insights (jsonb)
-- ai_traffic_insights (jsonb)
```

### Verificar Migración 025 (Trends)

```sql
-- Verificar vistas
SELECT viewname FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE '%evaluation%';

-- Debe mostrar:
-- offer_evaluation_trends
-- offer_evaluation_summary

-- Verificar función
SELECT proname FROM pg_proc
WHERE proname = 'get_evaluation_trend_comparison';

-- Probar la función
SELECT * FROM get_evaluation_trend_comparison('some-offer-uuid'::uuid);
```

### Verificar Migración 026 (Daily Checkin)

```sql
-- Verificar tabla DailyCheckin
\d "DailyCheckin"

-- Verificar funciones
SELECT proname FROM pg_proc
WHERE proname LIKE '%checkin%';

-- Debe mostrar:
-- get_user_checkin_status
-- calculate_checkin_reward
-- perform_daily_checkin
-- get_checkin_calendar

-- Probar la función de status (devuelve una fila)
SELECT * FROM get_user_checkin_status('test-user-id');

-- Probar la función de calendario (devuelve 7 filas)
SELECT * FROM get_checkin_calendar('test-user-id');
```

---

## Troubleshooting

### Error: "relation already exists"

Algunas migraciones son idempotentes (usan `IF NOT EXISTS`). Si ves este error, ignóralo.

### Error: "column already exists"

La migración 024 usa `ADD COLUMN IF NOT EXISTS`, así que este error no debería aparecer. Si aparece, verifica que estés ejecutando la versión correcta del archivo.

### Error: "connection timeout"

- Verifica que el VPC connector esté configurado correctamente
- Verifica que la IP del cliente esté whitelisted (para conexiones directas)
- Usa Cloud Run Job en lugar de conexión directa

### Error: "insufficient privileges"

Asegúrate de estar usando el usuario `postgres` con privilegios de superusuario.

---

## Siguientes Pasos

Una vez completadas las migraciones:

1. ✅ Reiniciar el servicio `billing` para que cargue los nuevos endpoints
   ```bash
   gcloud run deploy billing --region=asia-northeast1 \
     --source=./services/billing \
     --set-env-vars="DATABASE_URL=..." \
     --allow-unauthenticated=false
   ```

2. ✅ Probar los endpoints de checkin desde el frontend:
   - GET `/api/v1/billing/checkin/status`
   - POST `/api/v1/billing/checkin`

3. ✅ Verificar que el frontend `/settings/tokens` muestra correctamente:
   - Token balance con estadísticas
   - Daily checkin widget
   - Token transaction history

4. ✅ Ejecutar evaluaciones AI y verificar que los nuevos campos se guarden correctamente

---

## Referencias

- [AI Evaluation Migration Guide](./AI_Evaluation_Migration_Guide.md)
- [Frontend Phase 6 Summary](./Frontend_Phase6_Summary.md)
- [Project Completion Summary](./Project_Completion_Summary.md)

---

**Última actualización:** 2025-10-06
**Estado:** Migraciones listas para ejecutar, backend implementado, frontend completado
