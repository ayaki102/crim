#!/bin/bash

# Script to transfer Map Pins App to Raspberry Pi
# Usage: ./transfer-to-pi.sh PI_IP_ADDRESS

if [ $# -eq 0 ]; then
    echo "Usage: $0 <raspberry_pi_ip>"
    echo "Example: $0 192.168.1.100"
    exit 1
fi

PI_IP=$1
PI_USER=${2:-pi}  # Default to 'pi' user

echo "🍓 Transferring Map Pins App to Raspberry Pi..."
echo "Target: $PI_USER@$PI_IP"

# Check if we can reach the Pi
echo "📡 Testing connection to Pi..."
if ! ping -c 1 -W 5 "$PI_IP" > /dev/null 2>&1; then
    echo "❌ Cannot reach Pi at $PI_IP. Check IP address and network connection."
    exit 1
fi

# Test SSH connection
echo "🔐 Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$PI_USER@$PI_IP" exit 2>/dev/null; then
    echo "❌ Cannot SSH to Pi. Make sure SSH is enabled and you have the right credentials."
    echo "💡 Try: ssh-copy-id $PI_USER@$PI_IP"
    exit 1
fi

echo "✅ Connection successful!"

# Create directory on Pi
echo "📁 Creating project directory on Pi..."
ssh "$PI_USER@$PI_IP" "mkdir -p ~/map-pins-app"

# Transfer files (excluding node_modules and other unnecessary files)
echo "📦 Transferring project files..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'data/*.db' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    ./ "$PI_USER@$PI_IP:~/map-pins-app/"

if [ $? -eq 0 ]; then
    echo "✅ Files transferred successfully!"
    echo ""
    echo "Next steps:"
    echo "1. SSH into your Pi: ssh $PI_USER@$PI_IP"
    echo "2. Navigate to the app: cd ~/map-pins-app"
    echo "3. Run the deployment script: ./deploy-rpi.sh"
    echo ""
    echo "Or run all steps at once:"
    echo "ssh $PI_USER@$PI_IP 'cd ~/map-pins-app && ./deploy-rpi.sh'"
else
    echo "❌ Transfer failed!"
    exit 1
fi