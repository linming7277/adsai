module github.com/linming7277/adsai/pkg/http

go 1.25

require (
	github.com/linming7277/adsai/pkg/httpclient v0.0.0-20251024001746-c36c54440544
	github.com/linming7277/adsai/pkg/idempotency v0.0.0-00010101000000-000000000000
)

replace github.com/linming7277/adsai/pkg/idempotency => ../idempotency
