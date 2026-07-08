package handlers

import (
	"context"
	"fmt"
	"time"
)

// lookupIdem checks if an idempotency key exists and returns the target ID.
func (h *Handler) lookupIdem(ctx context.Context, key, userID, scope string) (string, bool) {
	var id string
	err := h.QueryRowContext(ctx, `
		SELECT target_id
		FROM idempotency_keys
		WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()
	`, key, userID, scope).Scan(&id)
	if err != nil {
		return "", false
	}
	return id, id != ""
}

// upsertIdem inserts or updates an idempotency key with the target ID and TTL.
func (h *Handler) upsertIdem(ctx context.Context, key, userID, scope, targetID string, ttl time.Duration) error {
	_, err := h.ExecContext(ctx, `
		INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at)
		VALUES ($1,$2,$3,$4,NOW(), NOW()+$5::interval)
		ON CONFLICT (key) DO UPDATE
		SET user_id=EXCLUDED.user_id,
		    scope=EXCLUDED.scope,
		    target_id=EXCLUDED.target_id,
		    expires_at=EXCLUDED.expires_at
	`, key, userID, scope, targetID, fmt.Sprintf("%d hours", int(ttl.Hours())))
	return err
}
