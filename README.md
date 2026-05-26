# Fintosa Board

A real-time, collaborative task management application. 

This project consists of an **Angular** frontend and a **Node.js/Express** backend with **Socket.io** for real-time synchronization.

---

## 🛠 Tech Stack

- **Frontend:** Angular, RxJS, SCSS
- **Backend:** Node.js, Express, Socket.io, Mongoose (MongoDB)
- **Authentication:** JWT (JSON Web Tokens)
- **Deployment:** GitHub Pages (Frontend), Railway (Backend)

---

## 🚀 How to Run Locally

To run the application on your local machine, you will need to start both the backend and frontend servers in separate terminal windows.

### 1. Backend Setup

Open a terminal and navigate to the `backend` folder:
```bash
cd backend
```

**Install dependencies:**
```bash
npm install
```

**Environment Variables:**
Create a `.env` file inside the `backend/` folder and add the following keys:
```env
PORT=5001
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
```
*(Make sure your local computer's IP address is whitelisted in your MongoDB Atlas network settings!)*

**Start the Development Server:**
```bash
npm run dev
```
The backend API and Socket server will now run on `http://localhost:5001`.

### 2. Frontend Setup

Open a **new** terminal window and navigate to the `frontend` folder:
```bash
cd frontend
```

**Install dependencies:**
```bash
npm install
```

**Verify Environment Configuration:**
Ensure that `frontend/src/environments/environment.ts` is pointing to your local backend:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5001/api',
  socketUrl: 'http://localhost:5001',
};
```

**Start the Angular Development Server:**
```bash
npm start
```
The frontend application will now run on `http://localhost:4200`.

---

## 🌍 Deployment

### Backend (Railway)
The backend is configured to be deployed seamlessly on [Railway.app](https://railway.app/).
1. Connect this repository to a new Railway project.
2. The included `nixpacks.toml` at the root of the repository will automatically navigate to the `backend/` folder, install dependencies, and run the server.
3. Add your `MONGO_URI` and `JWT_SECRET` in the Railway Variables dashboard.
4. **Important:** Add `0.0.0.0/0` (Allow Access From Anywhere) to your MongoDB Atlas Network Access whitelist so Railway can connect.

### Frontend (GitHub Pages)
The frontend is deployed to GitHub Pages using the `angular-cli-ghpages` package.
To publish a new version manually:
```bash
cd frontend
npm run build -- --configuration production
npx angular-cli-ghpages --dir=dist/fintosa-board
```

---

## ✨ Features
- **Real-Time Sync:** Tasks moved, edited, or created by one user appear instantly on all other clients using WebSockets.
- **Drag & Drop:** Intuitively organize your Sprint Board.
- **Business Logic Enforcement:** Strict backend validations (e.g., Completed tasks cannot move back to "To Do", due dates cannot be scheduled in the past).
- **Graceful Error Handling:** Full handling of corrupted data or tasks deleted by other users while you are viewing them.
- **Robust Filtering:** Instantly filter tasks by Status, Priority, Assignee, or Search Text.
