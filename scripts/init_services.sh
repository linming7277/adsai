#!/bin/bash
echo "--- Initializing Go Microservices ---"

# Navigate to the project root just in case
cd "$(dirname "$0")/.."

echo "Initializing Batchopen service..."
cd services/batchopen && go mod init adsai/batchopen && go mod tidy

echo "Initializing Adscenter service..."
cd ../adscenter && go mod init adsai/adscenter && go mod tidy

echo "Initializing Workflow service..."
cd ../workflow && go mod init adsai/workflow && go mod tidy

echo "--- All services initialized successfully! ---"
