#!/bin/bash

# Internet Exposure Setup Script for Raspberry Pi
# Run this on your Raspberry Pi after the app is deployed

echo "🌐 Map Pins App - Internet Exposure Setup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}📦 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "Choose your internet exposure method:"
echo ""
echo "1) Ngrok (Easiest - works in 5 minutes)"
echo "2) Cloudflare Tunnel (Best for permanent use)"
echo "3) Port Forwarding (Traditional method)"
echo "4) Show security setup only"
echo "5) Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        print_step "Setting up Ngrok..."
        
        # Check if ngrok is already installed
        if command -v ngrok &> /dev/null; then
            print_success "Ngrok already installed"
        else
            print_step "Downloading Ngrok..."
            cd /tmp
            wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm.tgz
            if [ $? -eq 0 ]; then
                tar xzf ngrok-v3-stable-linux-arm.tgz
                sudo mv ngrok /usr/local/bin
                print_success "Ngrok installed successfully"
            else
                print_error "Failed to download Ngrok"
                exit 1
            fi
        fi
        
        echo ""
        print_warning "Manual steps required:"
        echo "1. Go to https://ngrok.com and create a free account"
        echo "2. Get your authtoken from the dashboard"
        echo "3. Run: ngrok config add-authtoken YOUR_AUTHTOKEN"
        echo "4. Run: ngrok http 3000"
        echo ""
        echo "Your app will be accessible at a public URL like:"
        echo "https://abc123.ngrok.io"
        echo ""
        
        read -p "Do you want to create a permanent systemd service for ngrok? (y/n): " create_service
        if [[ $create_service == "y" || $create_service == "Y" ]]; then
            print_step "Creating systemd service..."
            sudo tee /etc/systemd/system/ngrok.service > /dev/null <<EOF
[Unit]
Description=Ngrok
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/local/bin/ngrok http 3000
Restart=on-failure
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF
            sudo systemctl daemon-reload
            print_success "Ngrok service created"
            echo "To start it: sudo systemctl start ngrok"
            echo "To enable auto-start: sudo systemctl enable ngrok"
            echo "To view logs: sudo journalctl -u ngrok -f"
        fi
        ;;
        
    2)
        echo ""
        print_step "Setting up Cloudflare Tunnel..."
        
        # Check if cloudflared is already installed
        if command -v cloudflared &> /dev/null; then
            print_success "Cloudflared already installed"
        else
            print_step "Downloading Cloudflared..."
            cd /tmp
            wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
            if [ $? -eq 0 ]; then
                sudo dpkg -i cloudflared-linux-arm64.deb
                print_success "Cloudflared installed successfully"
            else
                print_error "Failed to download Cloudflared"
                exit 1
            fi
        fi
        
        echo ""
        print_warning "Manual steps required:"
        echo "1. Go to https://cloudflare.com and create a free account"
        echo "2. Add a domain (can be free from Freenom or use subdomain)"
        echo "3. Run: cloudflared tunnel login"
        echo "4. Run: cloudflared tunnel create map-pins-app"
        echo "5. Create config file at ~/.cloudflared/config.yml"
        echo "6. Run: cloudflared tunnel run map-pins-app"
        echo ""
        echo "Your app will be accessible at: https://your-domain.com"
        echo "With automatic HTTPS and CDN!"
        ;;
        
    3)
        echo ""
        print_step "Port Forwarding Setup Guide..."
        echo ""
        print_warning "This requires access to your router admin panel"
        
        # Get local IP
        LOCAL_IP=$(hostname -I | awk '{print $1}')
        print_step "Your Pi's local IP: $LOCAL_IP"
        
        # Try to get public IP
        PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "Unable to detect")
        print_step "Your public IP: $PUBLIC_IP"
        
        echo ""
        echo "Steps to set up port forwarding:"
        echo "1. Open your router admin panel (usually http://192.168.1.1)"
        echo "2. Find 'Port Forwarding' or 'Virtual Server' section"
        echo "3. Add a new rule:"
        echo "   - External Port: 8080"
        echo "   - Internal IP: $LOCAL_IP"
        echo "   - Internal Port: 3000"
        echo "   - Protocol: TCP"
        echo "4. Save and restart your router"
        echo ""
        echo "Your app will be accessible at: http://$PUBLIC_IP:8080"
        echo ""
        print_warning "SECURITY WARNING: This exposes your app directly to the internet!"
        print_warning "Make sure to set up authentication (option 4) before doing this."
        ;;
        
    4)
        echo ""
        print_step "Security Setup..."
        
        # Install basic auth package
        APP_DIR="/home/pi/map-pins-app"
        if [ -d "$APP_DIR" ]; then
            cd "$APP_DIR"
            print_step "Installing express-basic-auth..."
            npm install express-basic-auth --save
            
            print_step "Security recommendations:"
            echo ""
            echo "1. Add basic authentication to your app:"
            echo "   - Modify server.js to include express-basic-auth"
            echo "   - Set strong username/password"
            echo ""
            echo "2. Enable firewall:"
            echo "   sudo ufw enable"
            echo "   sudo ufw allow ssh"
            echo "   sudo ufw allow 3000"
            echo ""
            echo "3. Change default passwords:"
            echo "   passwd  # Change pi user password"
            echo ""
            echo "4. Use HTTPS when possible"
            echo "   - Cloudflare Tunnel provides this automatically"
            echo "   - For port forwarding, consider Let's Encrypt"
            echo ""
            echo "5. Monitor access logs regularly"
            echo ""
        else
            print_error "App directory not found at $APP_DIR"
            print_warning "Make sure you've deployed the app first"
        fi
        ;;
        
    5)
        echo "Goodbye!"
        exit 0
        ;;
        
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
print_success "Setup complete!"
echo ""
echo "📚 For detailed guides, see:"
echo "- INTERNET_EXPOSURE.md (full documentation)"
echo "- RASPBERRY_PI.md (Pi-specific setup)"
echo ""
echo "🔒 Security reminders:"
echo "- Always use strong passwords"
echo "- Keep your Pi updated: sudo apt update && sudo apt upgrade"
echo "- Monitor access logs regularly"
echo "- Consider using HTTPS/TLS"