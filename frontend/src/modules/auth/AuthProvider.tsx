import { useEffect } from "react";
import { clearTokens } from "../../lib/api";
import { AuthContext } from "./AuthContext";
import { useMe } from "./hooks/useMe";
import { useLogin } from "./hooks/useLogin";
import { useLogout } from "./hooks/useLogout";
import type { AuthProviderProps, LoginResult } from "../../types/auth";

function hasStoredTokens(): boolean {
  return (
    localStorage.getItem("taskmanager_access_token") != null ||
    localStorage.getItem("taskmanager_refresh_token") != null
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  const hadTokens = hasStoredTokens();
  const meQuery = useMe({ enabled: hadTokens });
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  useEffect(() => {
    if (hadTokens && meQuery.isError) {
      clearTokens();
    }
  }, [hadTokens, meQuery.isError]);

  async function login(
    phone: string,
    password: string,
  ): Promise<LoginResult | undefined> {
    const res = await loginMutation.mutateAsync({ phone, password });
    return res?.data?.login;
  }

  async function logout(): Promise<void> {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Logging out locally must succeed even if the server call failed.
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

export default AuthProvider;
