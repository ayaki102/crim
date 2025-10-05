# Railway Deployment Guide for projekt_mops

## Prerequisites
✅ Railway CLI installed
✅ Project configured for Railway

## Deployment Steps

### 1. Login to Railway
```bash
railway login
```
This will open a browser window for authentication.

### 2. Initialize Railway project
```bash
railway init
```
- Choose "Empty Project" when prompted
- Give your project a name (e.g., "projekt-mops")

### 3. Add PostgreSQL Database
```bash
railway add postgresql
```
This automatically provisions a PostgreSQL database and sets the `DATABASE_URL` environment variable.

### 4. Deploy your application
```bash
railway up
```
This will:
- Build your application
- Deploy it to Railway
- Provide you with a public URL

### 5. Check deployment status
```bash
railway status
```

### 6. View logs (if needed)
```bash
railway logs
```

## What Railway Will Do Automatically

1. **Detect Node.js**: Railway will automatically detect your `package.json`
2. **Install dependencies**: Run `npm install`
3. **Start the app**: Use `npm start` command
4. **Provide SSL**: Automatic HTTPS certificate
5. **Database**: PostgreSQL database with `DATABASE_URL` environment variable
6. **Domain**: Give you a `railway.app` subdomain

## Environment Variables

Railway automatically sets:
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Set to `production`
- `PORT`: Assigned by Railway

## Alternative Deployment Methods

### Option 1: Connect GitHub Repository
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account
5. Select your repository
6. Add PostgreSQL service
7. Deploy!

### Option 2: Deploy from current directory
```bash
railway login
railway init
railway add postgresql
railway up
```

## Troubleshooting

### If deployment fails:
```bash
railway logs
```

### To redeploy:
```bash
railway up
```

### To open your deployed app:
```bash
railway open
```

## Expected Results

After successful deployment, you should see:
- A public URL for your app (e.g., `https://your-app.railway.app`)
- PostgreSQL database automatically connected
- SSL certificate automatically provisioned
- Your map pins application running in production

## Cost

- Railway offers a generous free tier
- Pay-as-you-use pricing
- Much more affordable than most cloud providers for small projects