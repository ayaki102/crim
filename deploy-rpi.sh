#!/bin/bash

# Raspberry Pi Deployment Script
# Run this script on your Raspberry Pi to deploy the Map Pins App

echo "🍓 Starting Raspberry Pi deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}📦 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running on Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    print_error "This script should be run on a Raspberry Pi"
    exit 1
fi

print_step "Updating system packages..."
sudo apt update && sudo apt upgrade -y

print_step "Installing Node.js (if not already installed)..."
if ! command -v node &> /dev/null; then
    # Install Node.js LTS for ARM
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

print_step "Installing Git (if not already installed)..."
if ! command -v git &> /dev/null; then
    sudo apt install -y git
fi

print_step "Creating application directory..."
APP_DIR="$HOME/map-pins-app"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

print_step "Installing dependencies..."
npm install

print_step "Creating data directory..."
mkdir -p data

print_step "Creating systemd service..."
sudo tee /etc/systemd/system/map-pins-app.service > /dev/null <<EOF
[Unit]
Description=Map Pins App
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node backend/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

print_step "Enabling and starting the service..."
sudo systemctl daemon-reload
sudo systemctl enable map-pins-app
sudo systemctl start map-pins-app

print_step "Checking service status..."
sleep 3
if sudo systemctl is-active --quiet map-pins-app; then
    print_success "Service is running!"
else
    print_error "Service failed to start. Check logs with: sudo journalctl -u map-pins-app -f"
    exit 1
fi

# Get Pi's IP address
PI_IP=$(hostname -I | awk '{print $1}')

print_success "🎉 Deployment complete!"
echo ""
echo "Your Map Pins App is now running on:"
echo "  Local:    http://localhost:3000"
echo "  Network:  http://$PI_IP:3000"
echo ""
echo "Service management commands:"
echo "  Status:   sudo systemctl status map-pins-app"
echo "  Stop:     sudo systemctl stop map-pins-app"
echo "  Start:    sudo systemctl start map-pins-app"
echo "  Restart:  sudo systemctl restart map-pins-app"
echo "  Logs:     sudo journalctl -u map-pins-app -f"
echo ""
echo "Database file location: $APP_DIR/data/pins.db"