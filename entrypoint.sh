#!/bin/sh
set -e  # Exit immediately if a command exits with a non-zero status

VAULT_ADDR="http://127.0.0.1:8200"

echo "Starting Vault Initialization..."
npm run vault:init

echo "Running Vault Transit..."
npm run vault:transit

echo "Starting Application in Production Mode..."
exec npm run start:prod

# echo "Checking Vault Initialization Status..."
# INIT_STATUS=$(curl -s ${VAULT_ADDR}/v1/sys/health | jq -r .initialized)

# if [ "$INIT_STATUS" = "false" ]; then
#     echo "Vault is not initialized. Running initialization..."
#     npm run vault:init
# else
#     echo "Vault is already initialized. Skipping initialization."
# fi

# echo "Checking if Vault Transit is enabled..."
# TRANSIT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${VAULT_ADDR}/v1/sys/mounts/transit)

# if [ "$TRANSIT_STATUS" != "200" ]; then
#     echo "Vault Transit is not enabled. Running transit setup..."
#     npm run vault:transit
# else
#     echo "Vault Transit is already enabled. Skipping transit setup."
# fi

# echo "Starting Application in Production Mode..."
# exec npm run start:prod
