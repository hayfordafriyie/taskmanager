import { createContext, useContext, useEffect, useState } from "react";
import { gql, clearTokens, setTokens } from "../lib/api";

const AuthContext = createContext(null);

function hasStoredTokens() {
  return (
    localStorage.getItem("taskmanager_access_token") != null ||
    localStorage.getItem("taskmanager_refresh_token") != null
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(() => hasStoredTokens());

  useEffect(() => {
    if (!hasStoredTokens()) {
      setInitializing(false);
      return;
    }
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const res = await gql(
        "query { me { id phone firstName surname otherNames } }",
      );
      const me = res?.data?.me;
      if (me) {
        setUser(me);
      } else {
        clearToken();
      }
    } catch {
      clearToken();
    } finally {
      setInitializing(false);
    }
  }

  function clearToken() {
    clearTokens();
    setUser(null);
  }

  async function login(phone, password) {
    const res = await gql(
      `mutation ($phone: String!, $password: String!) {
        login(phone: $phone, password: $password) {
          success message accessToken refreshToken user { id phone firstName surname otherNames }
        }
      }`,
      { phone, password },
    );
    const result = res?.data?.login;
    if (result?.success && result?.accessToken && result?.refreshToken) {
      setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
    }
    return result;
  }

  async function logout() {
    try {
      await gql("mutation { logout }");
    } catch {
    }
    clearToken();
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, initializing, login, logout }}
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