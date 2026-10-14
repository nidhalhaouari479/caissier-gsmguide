'use client';

import { createContext } from 'react';

export interface AuthUser {
  uid: number;
  username: string;
  name: string;
  company_id?: number;
  company_name?: string;
  company_names?: string[];
}

export interface AuthContextType {
  user: AuthUser | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (db: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  sessionId: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});
