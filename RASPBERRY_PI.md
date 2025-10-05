# 🍓 Raspberry Pi Deployment Guide

This guide will help you deploy the Map Pins App on your Raspberry Pi for 24/7 self-hosting.

## Prerequisites

- Raspberry Pi 3/4/5 with Raspberry Pi OS installed
- SSH access to your Pi (or direct terminal access)
- Internet connection

## Quick Deployment (Recommended)

### Method 1: Automated Script

1. **Transfer files to your Pi:**
   ```bash
   # From your Mac, copy the entire project to your Pi
   scp -r /Users/att4ch3d/projekt_mops pi@YOUR_PI_IP:~/
   
   # Or clone from git if you've pushed to a repository
   ssh pi@YOUR_PI_IP
   git clone https://github.com/your-repo/projekt_mops.git
   cd projekt_mops
   ```

2. **Run the deployment script:**
   ```bash
   # On your Raspberry Pi
   cd ~/projekt_mops
   ./deploy-rpi.sh
   ```

3. **Access your app:**
   - Local: `http://localhost:3000`
   - Network: `http://YOUR_PI_IP:3000`

### Method 2: Manual Setup

If you prefer manual control:

1. **SSH into your Pi:**
   ```bash
   ssh pi@YOUR_PI_IP
   ```

2. **Update system:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Clone/copy your project:**
   ```bash
   cd ~
   # Either copy from your Mac or clone from git
   ```

5. **Install dependencies:**
   ```bash
   cd projekt_mops
   npm install
   mkdir -p data
   ```

6. **Create systemd service:**
   ```bash
   sudo nano /etc/systemd/system/map-pins-app.service
   ```
   
   Paste this content:
   ```ini
   [Unit]
   Description=Map Pins App
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/projekt_mops
   ExecStart=/usr/bin/node backend/server.js
   Restart=on-failure
   RestartSec=10
   Environment=NODE_ENV=production
   Environment=PORT=3000

   [Install]
   WantedBy=multi-user.target
   ```

7. **Start the service:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable map-pins-app
   sudo systemctl start map-pins-app
   ```

## Managing Your App

### Service Commands
```bash
# Check status
sudo systemctl status map-pins-app

# Start/Stop/Restart
sudo systemctl start map-pins-app
sudo systemctl stop map-pins-app
sudo systemctl restart map-pins-app

# View logs
sudo journalctl -u map-pins-app -f

# View recent logs
sudo journalctl -u map-pins-app --since "1 hour ago"
```

### File Locations
- **App directory**: `/home/pi/projekt_mops`
- **Database**: `/home/pi/projekt_mops/data/pins.db`
- **Service file**: `/etc/systemd/system/map-pins-app.service`
- **Logs**: `sudo journalctl -u map-pins-app`

## Network Access

### Find Your Pi's IP Address
```bash
hostname -I
# or
ip addr show
```

### Access from Other Devices
- Open `http://YOUR_PI_IP:3000` in any browser on your network
- Works on phones, tablets, computers - anything connected to your WiFi

### Port Forwarding (Optional)
To access from outside your home network:

1. **Router configuration:**
   - Forward port 3000 to your Pi's IP
   - Or use a different external port (like 8080 → 3000)

2. **Security consideration:**
   ```bash
   # Change default port for security
   sudo systemctl edit map-pins-app
   ```
   Add:
   ```ini
   [Service]
   Environment=PORT=8080
   ```

## Performance Optimization

### For Raspberry Pi 3/older models:
```bash
# Use PM2 for better process management
sudo npm install -g pm2

# Create PM2 config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'map-pins-app',
    script: 'backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

## Backup & Updates

### Backup Database
```bash
# Create backup
cp /home/pi/projekt_mops/data/pins.db /home/pi/backup-$(date +%Y%m%d).db

# Automated daily backup
echo "0 2 * * * cp /home/pi/projekt_mops/data/pins.db /home/pi/backup-\$(date +\%Y\%m\%d).db" | crontab -
```

### Update Application
```bash
cd /home/pi/projekt_mops
git pull  # if using git
sudo systemctl restart map-pins-app
```

## Troubleshooting

### App won't start:
```bash
# Check logs
sudo journalctl -u map-pins-app -n 50

# Check if port is busy
sudo netstat -tlnp | grep 3000

# Test manually
cd /home/pi/projekt_mops
node backend/server.js
```

### Permission issues:
```bash
# Fix ownership
sudo chown -R pi:pi /home/pi/projekt_mops
chmod +x deploy-rpi.sh
```

### Memory issues (Pi 3):
```bash
# Check memory usage
free -h
htop

# Reduce memory usage
export NODE_OPTIONS="--max-old-space-size=512"
```

## Hardware Requirements

- **Raspberry Pi 3**: Works but may be slower with many concurrent users
- **Raspberry Pi 4/5**: Recommended for better performance
- **SD Card**: Class 10 or better, 16GB minimum
- **Power**: Official Pi power supply recommended

## Security

### Basic security hardening:
```bash
# Change default password
passwd

# Update regularly
sudo apt update && sudo apt upgrade -y

# Use firewall
sudo ufw enable
sudo ufw allow 3000
sudo ufw allow ssh
```

### SSL/HTTPS (Advanced):
```bash
# Install Nginx as reverse proxy
sudo apt install nginx
# Configure SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
```

Your Map Pins App is now running 24/7 on your Raspberry Pi! 🎉