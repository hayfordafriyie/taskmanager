import { createContext, useContext, useEffect } from "react";
import { clearTokens } from "../../lib/api";
import { useMe } from "./hooks/useMe";
import { useLogin } from "./hooks/useLogin";
import { useLogout } from "./hooks/useLogout";

const AuthContext = createContext(null);

function hasStoredTokens() {
  return (
    localStorage.getItem("taskmanager_access_token") != null ||
    localStorage.getItem("taskmanager_refresh_token") != null
  );
}

export function AuthProvider({ children }) {
  const hadTokens = hasStoredTokens();
  const meQuery = useMe({ enabled: hadTokens });
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  useEffect(() => {
    if (hadTokens && meQuery.isError) {
      clearTokens();
    }
  }, [hadTokens, meQuery.isError]);

  async function login(phone, password) {
    const res = await loginMutation.mutateAsync({ phone, password });
    return res?.data?.login;
  }

  async function logout() {
    try {
      await logoutMutation.mutateAsync();
    } catch {
    }
    clearTokens();
  }

  const user = meQuery.data ?? null;
  const initializing = hadTokens && meQuery.isPending;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        initializing,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}