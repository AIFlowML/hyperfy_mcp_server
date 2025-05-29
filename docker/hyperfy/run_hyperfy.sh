#!/bin/bash

# Hyperfy FastMCP Server - Docker Management Script
# This script manages the hyperfy-local container lifecycle

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emojis
ROCKET="🚀"
STOP="🛑"
INFO="ℹ️"
CHECK="✅"
GEAR="⚙️"

echo -e "${BLUE}${ROCKET} Hyperfy FastMCP Server - Docker Manager${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to check if container exists and is running
check_container_status() {
    if docker ps -q -f name=hyperfy-local | grep -q .; then
        return 0  # Container is running
    else
        return 1  # Container is not running
    fi
}

# Function to check if container exists (running or stopped)
check_container_exists() {
    if docker ps -aq -f name=hyperfy-local | grep -q .; then
        return 0  # Container exists
    else
        return 1  # Container doesn't exist
    fi
}

# Check current status
echo -e "${INFO} Checking current container status..."

if check_container_status; then
    echo -e "${YELLOW}${STOP} Container 'hyperfy-local' is currently running. Taking it down...${NC}"
    docker-compose down
    echo -e "${CHECK} Container stopped successfully${NC}"
elif check_container_exists; then
    echo -e "${YELLOW}${INFO} Container 'hyperfy-local' exists but is stopped. Removing it...${NC}"
    docker-compose down
    echo -e "${CHECK} Container removed successfully${NC}"
else
    echo -e "${CYAN}${INFO} No existing 'hyperfy-local' container found${NC}"
fi

echo ""
echo -e "${CYAN}${GEAR} Building and starting Hyperfy FastMCP Server...${NC}"

# Start the services
docker-compose up -d --build

echo ""
echo -e "${GREEN}${CHECK} Hyperfy FastMCP Server started successfully!${NC}"
echo ""
echo -e "${INFO} Container Status:"
docker-compose ps

echo ""
echo -e "${INFO} Useful Commands:"
echo -e "  ${CYAN}• View logs:${NC}           docker-compose logs -f hyperfy-local"
echo -e "  ${CYAN}• Stop container:${NC}      docker-compose down"
echo -e "  ${CYAN}• Restart container:${NC}   ./run_hyperfy.sh"
echo -e "  ${CYAN}• Shell into container:${NC} docker-compose exec hyperfy-local sh"

echo ""
echo -e "${INFO} Health Check:"
echo -e "  The container will be healthy when the MCP server is ready."
echo -e "  You can check health with: ${CYAN}docker-compose ps${NC}"

echo ""
echo -e "${INFO} Connection Info:"
echo -e "  ${CYAN}• MCP Server Port:${NC} 3069"
echo -e "  ${CYAN}• Health Endpoint:${NC} http://localhost:3069/health"
echo -e "  ${CYAN}• Container Name:${NC}  hyperfy-local"

echo ""
echo -e "${GREEN}${ROCKET} Setup complete! The Hyperfy FastMCP Server is now running.${NC}" 