# Build triggered: 2025-10-15 backend test v3
FROM golang:1.25 as builder
WORKDIR /workspace
ENV GO111MODULE=on
# Disable go.work to prevent missing modules error in container
ENV GOWORK=off
# Copy minimal workspace to avoid pulling frontend/node assets
COPY go.work go.work.sum ./
COPY pkg ./pkg
COPY services/offer ./services/offer
WORKDIR /workspace/services/offer
ARG COMMIT_SHA=local
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w -X main.buildVersion=${COMMIT_SHA} -X main.buildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" -o /offer-service .

FROM gcr.io/distroless/base-debian12
WORKDIR /
COPY --from=builder /offer-service /offer-service
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/offer-service"]
