import { useState, useEffect, createContext, useContext } from 'react';
import { authAPI } from '../lib/api';
import { getToken, setToken, removeToken, getUser, setUser, removeUser } from '../lib/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = getToken();
      if (token) {
        try {
          const response = await authAPI.validateToken();
          setUserState(response.data.user);
          setUser(response.data.user);
        } catch (error) {
          removeToken();
          removeUser();
          setUserState(null);
        }
      }
      setLoading(false);
    };

    validateToken();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      const { token, user } = response.data;
      
      setToken(token);
      setUser(user);
      setUserState(user);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erro ao fazer login' 
      };
    }
  };

  const logout = () => {
    removeToken();
    removeUser();
    setUserState(null);
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

