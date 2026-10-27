import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Users from './pages/Users';
import Tables from './pages/Tables';
import Stock from './pages/Stock';
import Comandas from './pages/Comandas';
import Queue from './pages/WaitingQueue';
import KitchenQueue from './pages/Queue';
import { Toaster } from 'sonner';
import Reports from './pages/Reports';
import Print from './pages/Print';
import './App.css';
import Settings from './pages/Settings';
import Customers from './pages/Customers';
import Recovery from './pages/Recovery';
import Support from './pages/Support';
import { BusinessProvider } from './hooks/useBusiness';

function App() {
  return (
    <AuthProvider>
    <BusinessProvider>
      <Toaster richColors />
      <Router>
        <Routes>
          <Route path="/reset-password" element={<Recovery />} />
          <Route path="/forgot-password" element={<Recovery />} />
          <Route path="/support" element={<Support />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route 
              index 
              element={
                <ProtectedRoute requiredRoles={['gerente', 'admin']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="products" 
              element={
                <ProtectedRoute requiredRoles={['gerente', 'admin']}>
                  <Products />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="sales" 
              element={
                <ProtectedRoute requiredRoles={['garcom', 'gerente', 'admin']}>
                  <Sales />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="tables" 
              element={
                <ProtectedRoute requiredRoles={['garcom', 'gerente', 'admin']}>
                  <Tables />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="stock" 
              element={
                <ProtectedRoute requiredRoles={['gerente', 'admin']}>
                  <Stock />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="comandas" 
              element={
                <ProtectedRoute requiredRoles={['garcom', 'gerente', 'admin']}>
                  <Comandas />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="queue" 
              element={
                <ProtectedRoute requiredRoles={['garcom', 'gerente', 'admin']}>
                  <Queue />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="reports" 
              element={
                <ProtectedRoute requiredRoles={['gerente', 'admin']}>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="print" 
              element={
                <ProtectedRoute requiredRoles={['garcom', 'gerente', 'admin']}>
                  <Print />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="users" 
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <Users />
                </ProtectedRoute>
              } 
            />
            <Route path="customers" element={<Customers />} />
            <Route path="settings" element={<ProtectedRoute requiredRoles={['admin', 'gerente']}><Settings /></ProtectedRoute>} />
            <Route path="kitchen" element={<ProtectedRoute requiredRoles={['garcom', 'gerente', 'admin']}><KitchenQueue /></ProtectedRoute>} />
          </Route>
        </Routes>
      </Router>
    </BusinessProvider>
    </AuthProvider>
  );
}

export default App;

