import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthenticatedLayout from "./layout/authenticated";
import UnauthenticatedLayout from "./layout/unauthenticated";
import Home from "./pages/home";
import Login from "./pages/login";
import Signup from "./pages/signup";
import ResetPassword from "./pages/reset-password";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/" element={<Home />} />
        </Route>
        <Route element={<UnauthenticatedLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;