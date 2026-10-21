import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UploadLogs from "./pages/UploadLogs";
import EmployeeList from "./pages/EmployeeList";
import EmployeeDetails from "./pages/EmployeeDetails";
import Alerts from "./pages/Alerts";
import Investigations from "./pages/Investigations";
import Reports from "./pages/Reports";
import Analytics from "./pages/Analytics";
import Notifications from "./pages/Notifications";
import UserManagement from "./pages/UserManagement";
import SettingsPage from "./pages/Settings";
import Profile from "./pages/Profile";
import Help from "./pages/Help";
import About from "./pages/About";

const P = ({ children, adminOnly }) => (
  <ProtectedRoute adminOnly={adminOnly}>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <Toaster theme="dark" position="top-right" richColors closeButton />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<P><Dashboard /></P>} />
            <Route path="/upload" element={<P><UploadLogs /></P>} />
            <Route path="/employees" element={<P><EmployeeList /></P>} />
            <Route path="/employees/:id" element={<P><EmployeeDetails /></P>} />
            <Route path="/alerts" element={<P><Alerts /></P>} />
            <Route path="/investigations" element={<P><Investigations /></P>} />
            <Route path="/reports" element={<P><Reports /></P>} />
            <Route path="/analytics" element={<P><Analytics /></P>} />
            <Route path="/notifications" element={<P><Notifications /></P>} />
            <Route path="/users" element={<P adminOnly><UserManagement /></P>} />
            <Route path="/settings" element={<P adminOnly><SettingsPage /></P>} />
            <Route path="/profile" element={<P><Profile /></P>} />
            <Route path="/help" element={<P><Help /></P>} />
            <Route path="/about" element={<P><About /></P>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
