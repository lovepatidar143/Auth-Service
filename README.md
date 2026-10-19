# Auth Service

A full-stack authentication and authorization application with a React frontend and a Node.js backend.

## 📁 Project Structure

```text
Auth-Service/
├── frontend/       # React frontend
├── backend/        # Express.js authentication API
└── README.md
```

## 🛠️ Tech Stack

- **Frontend:** React, JavaScript
- **Backend:** Node.js, Express 5
- **Database:** MongoDB, Mongoose
- **Authentication:** JWT, HTTP-only cookies
- **Security:** bcrypt, rate limiting, role-based access control
- **Testing:** Node.js Test Runner, Supertest

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:

- Node.js 20 or later
- npm
- MongoDB (local installation or MongoDB Atlas account)
- Git

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Auth-Service
```

### 2. Configure the Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Open `backend/.env` and configure the required environment variables.

#### Backend Environment Variables

```env
NODE_ENV=development
PORT=8080
APP_NAME=Auth Service
APP_BASE_URL=http://localhost:8080

CORS_ORIGIN=http://localhost:5173

MONGODB_URI=your_mongodb_connection_string

ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret

ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

REQUIRE_EMAIL_VERIFICATION=true

MAILTRAP_SMTP_HOST=
MAILTRAP_SMTP_PORT=
MAILTRAP_SMTP_USER=
MAILTRAP_SMTP_PASS=

MAIL_FROM="Auth Service <no-reply@example.com>"
```

**Important:**

- Replace `your_mongodb_connection_string` with your actual MongoDB connection string.
- Generate separate, cryptographically secure secrets for access and refresh tokens. Each must contain at least 32 characters.
- Configure SMTP credentials if you want to send emails through an email provider.
- During development, emails can be printed in the backend console when SMTP is not configured.
- Check `backend/.env.example` for all supported environment variables.
- Never commit your actual `.env` file to GitHub.

Generate a secure secret using:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run the command twice to generate two different secrets.

### 3. Start the Backend

From the `backend/` directory, run:

```bash
npm run dev
```

The backend should start on the port configured in your `.env` file.

**Backend URL:**

```text
http://localhost:8080
```

**Health Check:**

```text
http://localhost:8080/api/v1/healthcheck
```

### 4. Configure the Frontend

Open a new terminal from the project root and navigate to the frontend directory:

```bash
cd frontend
npm install
```

If the frontend requires environment variables, create a `.env` file inside `frontend/`.

For example, if your frontend uses Vite:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

Make sure the variable name matches what your frontend code actually uses.

For Vite applications, client-side environment variables must use the `VITE_` prefix.

### 5. Start the Frontend

From the `frontend/` directory, run:

```bash
npm run dev
```

Vite typically serves the frontend at:

```text
http://localhost:5173
```

Open the URL displayed in your terminal to access the application.

## 🔐 Authentication Features

- User registration and login
- JWT access and refresh tokens
- HTTP-only cookie authentication
- Email verification and password recovery
- Refresh-token rotation and reuse detection
- Per-device session management
- Logout from one or all devices
- Role-based access control (RBAC)
- Rate limiting and account lockout
- Admin user management
- Input validation and centralized error handling

## 🧪 Running Backend Tests

Navigate to the backend directory:

```bash
cd backend
npm test
```

The backend includes 42 integration tests using Node.js Test Runner and Supertest.

Tests use an in-memory MongoDB instance through `mongodb-memory-server`, unless configured to use a separate test database.

## 👑 Creating the First Admin

The backend does not allow users to create admin accounts through public registration.

From the `backend/` directory, run:

```bash
ADMIN_EMAIL=you@example.com ADMIN_USERNAME=admin ADMIN_PASSWORD='StrongPass123' npm run seed:admin
```

Replace the example credentials with your own strong credentials.

## 📚 Backend Documentation

For detailed information about API endpoints, request and response formats, error codes, security mechanisms, environment variables, and integration tests, see:

[`backend/README.md`](backend/README.md)


## 👨‍💻 Developer

**Love Patidar**  
MANIT Bhopal | Software Developer

*Designed and developed with ❤️ by Love Patidar.*