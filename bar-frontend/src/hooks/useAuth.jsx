import { useState, useEffect, createContext, useContext } from 'react';
import api, { authAPI } from '../lib/api';
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
        } catch {
          removeToken();
          removeUser();
          setUserState(null);
        }
      }
      setLoading(false);
    };

    validateToken();
  }, []);

  useEffect(()=>{
    const refresh=async()=>{if(!getToken())return;try{const {data}=await authAPI.validateToken();setUserState(data.user);setUser(data.user)}catch(e){if(e.response?.status===401){removeToken();removeUser();setUserState(null)}}};
    const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh()},30000);
    window.addEventListener('focus',refresh);window.addEventListener('pdv-access-change',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('pdv-access-change',refresh)};
  },[]);
  const login = async (credentials) => {
    try {
      const response = await authAPI.login({...credentials,company:credentials.company?.trim().toLowerCase()});
      const { token, user } = response.data;

      localStorage.setItem('company',user.company);window.dispatchEvent(new Event('pdv-company-change'));
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

  const logout = async () => {
    if(user?.support){try{await api.post('/support/session/end');}catch{/* A sessão local é encerrada mesmo em falha de conexão. */}}
    removeToken();
    removeUser();
    setUserState(null);
  };

  const enterSupportSession = ({token,user}) => {
    localStorage.setItem('company',user.company);window.dispatchEvent(new Event('pdv-company-change'));setToken(token);setUser(user);setUserState(user);
  };
  const value = {
    enterSupportSession,
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

