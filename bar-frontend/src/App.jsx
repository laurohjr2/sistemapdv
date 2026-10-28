import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {useAuth} from './hooks/useAuth';
import ScaleLabels from './pages/ScaleLabels';
import Recipes from './pages/Recipes';
import Deliveries from './pages/Deliveries';
import Market from './pages/Market';
import AutoParts from './pages/AutoParts';
import Workshop from './pages/Workshop';
import Pizzeria from './pages/Pizzeria';
import About from './pages/About';
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
import Quotes from './pages/Quotes';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Finance from './pages/Finance';
import BusinessModuleRoute from './components/BusinessModuleRoute';
import Customers from './pages/Customers';
import Recovery from './pages/Recovery';
import Support from './pages/Support';
import { BusinessProvider } from './hooks/useBusiness';

function Home(){const {user}=useAuth();return user?.role==='garcom'?<Navigate to="/sales" replace/>:<Dashboard/>;}
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
                <Home/>
              } 
            />
            <Route path="deliveries" element={<BusinessModuleRoute module="delivery"><Deliveries/></BusinessModuleRoute>}/>
            <Route path="recipes" element={<ProtectedRoute requiredRoles={['admin','gerente']}><BusinessModuleRoute module="recipes"><Recipes/></BusinessModuleRoute></ProtectedRoute>}/>
            <Route path="scale-labels" element={<BusinessModuleRoute module="market"><ScaleLabels/></BusinessModuleRoute>}/>
            <Route path="market" element={<BusinessModuleRoute module="market"><Market/></BusinessModuleRoute>}/>
            <Route path="autoparts" element={<BusinessModuleRoute module="autoparts"><AutoParts/></BusinessModuleRoute>}/>
            <Route path="workshop" element={<BusinessModuleRoute module="workshop"><Workshop/></BusinessModuleRoute>}/>
            <Route path="pizzeria" element={<ProtectedRoute requiredRoles={['admin','gerente']}><BusinessModuleRoute module="pizza"><Pizzeria/></BusinessModuleRoute></ProtectedRoute>}/>
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
                  <BusinessModuleRoute module="tables"><Tables /></BusinessModuleRoute>
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
                  <BusinessModuleRoute module="tables"><Comandas /></BusinessModuleRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="queue" 
              element={
                <ProtectedRoute requiredRoles={['garcom', 'gerente', 'admin']}>
                  <BusinessModuleRoute module="tables"><Queue /></BusinessModuleRoute>
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
            <Route path="quotes" element={<BusinessModuleRoute module="quotes"><Quotes/></BusinessModuleRoute>}/>
            <Route path="suppliers" element={<ProtectedRoute requiredRoles={['admin','gerente']}><BusinessModuleRoute module="purchasing"><Suppliers/></BusinessModuleRoute></ProtectedRoute>}/>
            <Route path="purchases" element={<ProtectedRoute requiredRoles={['admin','gerente']}><BusinessModuleRoute module="purchasing"><Purchases/></BusinessModuleRoute></ProtectedRoute>}/>
            <Route path="finance" element={<ProtectedRoute requiredRoles={['admin','gerente']}><BusinessModuleRoute module="finance"><Finance/></BusinessModuleRoute></ProtectedRoute>}/>
            <Route path="about" element={<About/>}/><Route path="customers" element={<Customers />} />
            <Route path="settings" element={<ProtectedRoute requiredRoles={['admin', 'gerente']}><Settings /></ProtectedRoute>} />
            <Route path="kitchen" element={<ProtectedRoute requiredRoles={['garcom', 'gerente', 'admin']}><BusinessModuleRoute module="kitchen"><KitchenQueue /></BusinessModuleRoute></ProtectedRoute>} />
          </Route>
        </Routes>
      </Router>
    </BusinessProvider>
    </AuthProvider>
  );
}

export default App;

