import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import '../App.css';
import BusinessBrand from '../components/BusinessBrand';

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    company: localStorage.getItem('company') || '',
    username: '',
    password: '',
  });
  const [showPassword,setShowPassword]=useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if(['master.local','support.local'].includes(formData.username.trim().toLowerCase())){setError('Esta é uma conta do fornecedor. Use o acesso Master / suporte abaixo.');setLoading(false);return;}
    const result = await login(formData);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold"><BusinessBrand /></CardTitle>
          <CardDescription>
            Acesso da empresa — operador, gerente ou administrador
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="company">Código da empresa</Label>
              <Input id="company" name="company" onBlur={e=>{localStorage.setItem('company',e.target.value.trim().toLowerCase());window.dispatchEvent(new Event('pdv-company-change'));}} value={formData.company} onChange={handleChange} required disabled={loading} placeholder="Ex.: meu-bar" autoComplete="organization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Digite seu usuário"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type={showPassword?'text':'password'}
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Digite sua senha"
              />
              <Button type="button" variant="ghost" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</Button>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
          <Link to="/forgot-password" className="mt-4 block text-center text-sm underline">Esqueci minha senha</Link>
          <Link to="/support" className="mt-4 block text-center text-sm underline">Acesso do fornecedor — Master / suporte</Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

