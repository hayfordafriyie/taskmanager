import { BrowserRouter, Routes, Route } from "react-router-dom";
import ToastProvider from "./components/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthenticatedLayout from "./layout/authenticated";
import UnauthenticatedLayout from "./layout/unauthenticated";
import { AuthProvider } from "./modules/auth/AuthContext";
import Home from "./modules/home";
import Login from "./modules/login";
import Signup from "./modules/signup";
import ResetPassword from "./modules/reset-password";

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Home />} />
            </Route>
            <Route element={<UnauthenticatedLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
