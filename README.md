<div align="center">

# 🐦 **Twitter Clone**
*A Next-Generation Social Media Platform*

<img src="https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=for-the-badge" alt="Status">
<img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
<img src="https://img.shields.io/badge/PRs-Welcome-ff69b4?style=for-the-badge" alt="PRs Welcome">

**🚀 A modern, feature-rich social media platform engineered with cutting-edge technologies**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React%2018-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js%2018+-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2015-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![AWS](https://img.shields.io/badge/AWS%20S3-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

<div align="center">

## 🚀 **What Makes This Special?**

<table>
<tr>
<td width="33%">

### 🚀 **Performance First**
- **Lightning-fast** loading times
- **Optimized** database queries
- **Efficient** caching strategies
- **Real-time** updates via WebSocket

</td>
<td width="33%">

### 🔐 **Enterprise Security**
- **End-to-end** encryption
- **Multi-layer** authentication
- **Rate limiting** protection
- **GDPR compliant** data handling

</td>
<td width="33%">

### 🎨 **Modern UX/UI**
- **Responsive** design for all devices
- **Accessibility** focused (WCAG 2.1)
- **Intuitive** user interface
- **Smooth** animations & transitions

</td>
</tr>
</table>

</div>

---

<div align="center">

## ✨ **Core Features Overview**

| 🔐 **Authentication** | 📝 **Content Creation** | 🔄 **Social Features** | 📱 **User Experience** |
|:---:|:---:|:---:|:---:|
| JWT + Refresh Tokens | Rich Text Tweets | Real-time Likes/RTs | Responsive Design |
| OAuth Integration | Media Uploads (S3) | Follow/Unfollow | Intuitive UI |
| 2FA Support | Interactive Polls | Direct Messaging | Infinite Scroll |
| Session Management | Hashtag Detection | Notifications | Progressive Web App |

</div>

---

<div align="center">

## 🛠️ **Technology Deep Dive**

</div>

<div align="center">

### **Frontend Excellence**
```
┌─────────────────────────────────────────────────┐
│  🎨 Modern React Ecosystem                     │
├─────────────────────────────────────────────────┤
│  • React 18 with Concurrent Features           │
│  • TypeScript for Type Safety                  │
│  • Vite for Lightning-Fast Development         │
│  • Tailwind CSS for Utility-First Styling      │
│  • React Query for Server State Management     │
│  • Zustand for Client State Management         │
│  • React Hook Form for Form Handling           │
│  • Framer Motion for Smooth Animations         │
└─────────────────────────────────────────────────┘
```

</div>

<div align="center">

### **Backend Powerhouse**
```
┌────────────────────────────────────────────────┐
│  ⚡ Robust Node.js Infrastructure              │
├────────────────────────────────────────────────┤
│  • Express.js with TypeScript                  │
│  • Prisma ORM with Type-Safe Database Access   │
│  • JWT Authentication with Refresh Tokens      │
│  • WebSocket Real-time Communication           │
│  • Winston Structured Logging                  │
│  • Helmet.js Security Middleware               │
│  • Express Rate Limit                          │
│  • Multer for File Upload Handling             │
└─────────────────────────────────────────────────┘
```

</div>

<div align="center">

### **Database & Infrastructure**
```
┌─────────────────────────────────────────────────┐
│  🗄️ Production-Grade Data Stack                │
├─────────────────────────────────────────────────┤
│  • PostgreSQL 15 with Advanced Features        │
│  • In-Memory Rate Limiting & Session Storage   │
│  • AWS S3 for Scalable Media Storage           │
│  • Docker Multi-Stage Builds                   │
│  • Docker Compose for Development              │
│  • SSL/TLS Encryption                          │
│  • Database Connection Pooling                 │
│  • Automated Backup Strategies                 │
└─────────────────────────────────────────────────┘
```

</div>

</div>

---

---

## 📚 API Documentation

### 🔐 Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Create new user account |
| `POST` | `/api/auth/login` | User authentication |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `GET` | `/api/auth/me` | Get current user info |
| `POST` | `/api/auth/logout` | Logout user |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `POST` | `/api/auth/reset-password` | Reset password with token |

### 📝 Tweet Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tweets` | Get timeline/feed |
| `POST` | `/api/tweets` | Create new tweet |
| `GET` | `/api/tweets/:id` | Get specific tweet |
| `DELETE` | `/api/tweets/:id` | Delete tweet |
| `POST` | `/api/tweets/:id/like` | Toggle like on tweet |
| `POST` | `/api/tweets/:id/retweet` | Toggle retweet |
| `POST` | `/api/tweets/:id/reply` | Reply to tweet |
| `GET` | `/api/tweets/:id/replies` | Get tweet replies |
| `POST` | `/api/tweets/:id/bookmark` | Toggle bookmark |

### 👥 User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/:id` | Get user profile |
| `PUT` | `/api/users/:id` | Update profile |
| `POST` | `/api/users/:id/follow` | Toggle follow user |
| `GET` | `/api/users/:id/followers` | Get user followers |
| `GET` | `/api/users/:id/following` | Get following list |
| `GET` | `/api/users/:id/tweets` | Get user tweets |

### 💬 Direct Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dm/conversations` | Get conversations list |
| `POST` | `/api/dm/conversations` | Start new conversation |
| `GET` | `/api/dm/conversations/:id` | Get conversation messages |
| `POST` | `/api/dm/conversations/:id/messages` | Send message |
| `PUT` | `/api/dm/messages/:id` | Mark message as read |
| `DELETE` | `/api/dm/messages/:id` | Delete message |

### 🔍 Search & Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search` | Global search |
| `GET` | `/api/search/users` | Search users |
| `GET` | `/api/search/tweets` | Search tweets |
| `GET` | `/api/trends` | Get trending topics |
| `GET` | `/api/hashtags/:tag` | Get hashtag timeline |

### 🔔 Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications` | Get notifications |
| `PUT` | `/api/notifications/:id/read` | Mark as read |
| `PUT` | `/api/notifications/read-all` | Mark all as read |
| `DELETE` | `/api/notifications/:id` | Delete notification |

---

## 🏗️ **Development Guide**

### 📁 **Project Structure**

```
twitter-clone/
├── 📁 backend/                    # Node.js API Server
│   ├── 📁 src/
│   │   ├── 📁 routes/             # API route handlers
│   │   │   ├── 📄 auth.ts         # Authentication routes
│   │   │   ├── 📄 tweets.ts       # Tweet management
│   │   │   ├── 📄 users.ts        # User operations
│   │   │   ├── 📄 dm.ts           # Direct messages
│   │   │   ├── 📄 search.ts       # Search functionality
│   │   │   ├── 📄 trends.ts       # Trending topics
│   │   │   └── 📄 notifications.ts # Notification system
│   │   ├── 📁 middleware/         # Custom middleware
│   │   │   ├── 📄 auth.ts         # JWT authentication
│   │   │   ├── 📄 rateLimit.ts    # Rate limiting
│   │   │   └── 📄 errorHandler.ts # Error handling
│   │   ├── 📁 utils/              # Utility functions
│   │   │   ├── 📄 logger.ts       # Winston logging
│   │   │   ├── 📄 cleanup.ts      # Cleanup services
│   │   │   └── 📄 validation.ts   # Input validation
│   │   ├── 📄 index.ts            # Entry point
│   │   ├── 📄 db.ts               # Database connection
│   │   └── 📄 websocket.ts        # WebSocket setup
│   ├── 📁 prisma/                 # Database schema & migrations
│   │   ├── 📄 schema.prisma       # Database schema
│   │   └── 📁 migrations/         # Migration files
│   ├── 📁 ssl/                    # SSL certificates
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   └── 📄 Dockerfile
├── 📁 frontend/                   # React Application
│   ├── 📁 src/
│   │   ├── 📁 components/         # Reusable React components
│   │   │   ├── 📄 TweetItem.tsx   # Tweet display component
│   │   │   ├── 📄 TweetComposer.tsx # Tweet creation
│   │   │   ├── 📄 UserProfile.tsx # User profile display
│   │   │   ├── 📄 Sidebar.tsx     # Navigation sidebar
│   │   │   ├── 📄 Header.tsx      # App header
│   │   │   └── 📄 Layout.tsx      # Main layout wrapper
│   │   ├── 📁 pages/              # Page components
│   │   │   ├── 📄 Home.tsx        # Home timeline
│   │   │   ├── 📄 Profile.tsx     # User profile page
│   │   │   ├── 📄 Messages.tsx    # Direct messages
│   │   │   ├── 📄 Search.tsx      # Search page
│   │   │   ├── 📄 Trends.tsx      # Trending topics
│   │   │   └── 📄 Notifications.tsx # Notifications
│   │   ├── 📁 hooks/              # Custom React hooks
│   │   │   ├── 📄 useAuth.ts      # Authentication hook
│   │   │   ├── 📄 useWebSocket.ts # WebSocket hook
│   │   │   ├── 📄 useToast.ts     # Toast notifications
│   │   │   └── 📄 useInfiniteScroll.ts # Infinite scroll
│   │   ├── 📁 store/              # State management
│   │   │   ├── 📄 authStore.ts    # Auth state (Zustand)
│   │   │   ├── 📄 tweetStore.ts   # Tweet state
│   │   │   ├── 📄 themeStore.ts   # Theme state
│   │   │   └── 📄 notificationStore.ts # Notification state
│   │   ├── 📁 api/                # API client functions
│   │   │   ├── 📄 client.ts       # Axios setup
│   │   │   ├── 📄 auth.ts         # Auth API calls
│   │   │   ├── 📄 tweets.ts       # Tweet API calls
│   │   │   ├── 📄 users.ts        # User API calls
│   │   │   └── 📄 dm.ts           # Direct message calls
│   │   ├── 📁 types/              # TypeScript type definitions
│   │   ├── 📁 utils/              # Utility functions
│   │   └── 📄 main.tsx            # App entry point
│   ├── 📁 public/                 # Static assets
│   ├── 📄 package.json
│   ├── 📄 vite.config.ts
│   ├── 📄 tailwind.config.js
│   └── 📄 tsconfig.json
├── 📄 docker-compose.yml          # Docker configuration
├── 📄 .env.example                # Environment template
├── 📄 setup.sh                    # Setup script
├── 📄 verify-setup.sh             # Verification script
└── 📄 README.md                   # This file
```

### ⚡ Development Commands

**🐳 Docker Commands:**
```bash
docker compose up -d          # Start all services
docker compose down           # Stop all services
docker compose logs -f        # View logs
docker compose build          # Rebuild containers
```

**⚙️ Backend Commands:**
```bash
cd backend
npm run dev                   # Start development server
npm run build                 # Build for production
npx prisma migrate dev        # Create database migration
npx prisma generate           # Generate Prisma client
```

**🎨 Frontend Commands:**
```bash
cd frontend
npm run dev                   # Start development server
npm run build                 # Build for production
npm run lint                  # Lint code
```

---

## 🔒 Security & Performance

**🛡️ Security Features:**
- JWT authentication with refresh tokens
- HTTPS/TLS encryption
- Input validation and sanitization
- Rate limiting protection
- SQL injection protection via Prisma ORM

**⚡ Performance Optimizations:**
- Code splitting and lazy loading
- Database connection pooling
- Efficient caching strategies
- Optimized database queries

---

<div align="center">

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

</div>
