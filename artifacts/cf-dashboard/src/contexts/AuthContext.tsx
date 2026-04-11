import { createContext, useContext, useState, ReactNode } from "react";
import { setCredentials, clearCredentials, getCredentials, testAuth } from "@/lib/api";

interface AuthContextType {
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getCredentials());

  const login = async (username: string, password: string) => {
    const ok = await testAuth(username, password);
    if (ok) {
      setCredentials(username, password);
      setIsLoggedIn(true);
    }
    return ok;
  };

  const logout = () => {
    clearCredentials();
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
