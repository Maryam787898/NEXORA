# NEXORA E-Commerce API Backend

Node.js & Express RESTful API backend for the NEXORA E-Commerce platform.

## Folder Structure

```
server/
├── src/
│   ├── config/       # Environment & DB configurations
│   ├── controllers/  # Route controller handlers
│   ├── middleware/   # Custom Express middleware
│   ├── models/       # Database schemas & models
│   ├── routes/       # API endpoints & routing
│   ├── utils/        # Utility helpers
│   ├── app.js        # Express app initialization & middleware
│   └── server.js     # HTTP server listener entry point
├── .env              # Local environment variables
├── .env.example      # Environment variables template
├── .gitignore        # Git ignore rules
├── package.json      # Dependencies and npm scripts
└── README.md         # Documentation
```

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Development Mode**:
   ```bash
   npm run dev
   ```

4. **Production Mode**:
   ```bash
   npm start
   ```

## Endpoints

- `GET /api/health` — API health status check
