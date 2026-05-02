# TaskForge

TaskForge is a full-stack team task manager built with React, TypeScript, Express, and MongoDB. It supports role-based access so admins can manage projects and tasks while members can focus on assigned work.

## What It Does

- Secure auth with JWT login and registration
- Admin and member roles
- Project creation, member assignment, and management
- Task creation, assignment, status updates, and deletion
- Dashboard with task and project summaries

## Tech Stack

Frontend:

- React 19
- TypeScript
- Tailwind CSS and shadcn/ui
- React Router v7
- Axios

Backend:

- Node.js
- Express 5
- MongoDB and Mongoose
- JWT and bcrypt
- express-validator

## Local Setup

### Prerequisites

- Node.js 20+
- MongoDB Atlas or a local MongoDB instance

### Install

```bash
npm install
```

### Environment

Create or update these files before running the app:

- `server/.env` for backend secrets and MongoDB connection
- `.env` for the frontend API base URL

Example values:

```dotenv
# server/.env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/taskflow?retryWrites=true&w=majority
JWT_SECRET=replace_this_in_production
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

```dotenv
# .env
VITE_API_URL=http://localhost:5000/api
```

### Run in Development

```bash
npm run dev
```

This starts the frontend and backend together.

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Scripts

- `npm run dev` - Start frontend and backend together
- `npm run client` - Start Vite only
- `npm run server` - Start backend in development mode
- `npm run build` - Build frontend and backend for production
- `npm start` - Run the compiled production backend
- `npm run seed` - Seed the database with a demo admin account

## Production Build

```bash
npm run build
npm start
```

The production build outputs the backend to `dist-server/` and the frontend to `dist/`.

## Deployment Notes

### Frontend

Deploy the frontend to Vercel or any static host that supports Vite builds.

Required env var:

- `VITE_API_URL` should point to your deployed backend API, for example `https://your-api-domain.com/api`

### Backend

Deploy the backend to Railway, Render, or another Node host.

Required env vars:

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `NODE_ENV=production`

### Seed Data

If you need a demo admin account for review or testing, run:

```bash
npm run seed
```

## API Overview

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/users`

Projects:

- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`
- `PUT /api/projects/:id/members`
- `DELETE /api/projects/:id/members`

Tasks:

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

Dashboard:

- `GET /api/dashboard/stats`

## Access Rules

| Action | Admin | Member |
|--------|-------|--------|
| Create projects | Yes | No |
| Add/remove members | Yes | No |
| Create/assign tasks | Yes | No |
| Delete tasks | Yes | No |
| View all projects | Yes | No |
| View assigned projects | Yes | Yes |
| View tasks | Yes | Yes |
| Update task status | Yes | Yes (own tasks) |
| Update task details | Yes | No |

## Project Structure

```text
├── server/                 Express backend
│   ├── config/             DB and env configuration
│   ├── controllers/        Route handlers
│   ├── middleware/         Auth and error handling
│   ├── models/             Mongoose models
│   └── routes/             API routes
├── src/                    React frontend
│   ├── components/         UI and layout components
│   ├── hooks/              Shared hooks
│   ├── pages/              App pages
│   ├── services/           API client
│   └── types/              TypeScript types
├── dist/                   Frontend production build
└── dist-server/            Backend production build
```
For frontend 
|-src
|    App.css
│   App.tsx
│   index.css
│   main.tsx
│   
├───components
│   │   Layout.tsx
│   │   ProtectedRoute.tsx
│   │   
│   └───ui
│           accordion.tsx
│           alert-dialog.tsx
│           alert.tsx
│           aspect-ratio.tsx
│           avatar.tsx
│           badge.tsx
│           breadcrumb.tsx
│           button-group.tsx
│           button.tsx
│           calendar.tsx
│           card.tsx
│           carousel.tsx
│           chart.tsx
│           checkbox.tsx
│           collapsible.tsx
│           command.tsx
│           context-menu.tsx
│           dialog.tsx
│           drawer.tsx
│           dropdown-menu.tsx
│           empty.tsx
│           field.tsx
│           form.tsx
│           hover-card.tsx
│           input-group.tsx
│           input-otp.tsx
│           input.tsx
│           item.tsx
│           kbd.tsx
│           label.tsx
│           menubar.tsx
│           navigation-menu.tsx
│           pagination.tsx
│           popover.tsx
│           progress.tsx
│           radio-group.tsx
│           resizable.tsx
│           scroll-area.tsx
│           select.tsx
│           separator.tsx
│           sheet.tsx
│           sidebar.tsx
│           skeleton.tsx
│           slider.tsx
│           sonner.tsx
│           spinner.tsx
│           switch.tsx
│           table.tsx
│           tabs.tsx
│           textarea.tsx
│           toggle-group.tsx
│           toggle.tsx
│           tooltip.tsx
│           
├───hooks
│       use-mobile.ts
│       useAuth.tsx
│       
├───lib
│       utils.ts
│       
├───pages
│       Dashboard.tsx
│       Home.tsx
│       Login.tsx
│       Projects.tsx
│       Signup.tsx
│       Tasks.tsx
│       
├───services
│       api.ts
│       
└───types
        index.t