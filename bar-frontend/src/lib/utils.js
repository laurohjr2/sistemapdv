import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (value) => {
  // Verificar se o valor é válido antes de formatar
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00';
  }
  
  // Converter para número se for string
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Verificar novamente se é um número válido
  if (isNaN(numericValue)) {
    return 'R$ 0,00';
  }
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue);
};

export const formatDate = (date) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const formatTime = (date) => {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const getTableStatusColor = (status) => {
  switch (status) {
    case 'disponivel':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'ocupada':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'aguardando_fechamento':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getTableStatusText = (status) => {
  switch (status) {
    case 'disponivel':
      return 'Disponível';
    case 'ocupada':
      return 'Ocupada';
    case 'aguardando_fechamento':
      return 'Aguardando';
    default:
      return status;
  }
};

export const getRoleText = (role) => {
  switch (role) {
    case 'admin':
      return 'Administrador';
    case 'gerente':
      return 'Gerente';
    case 'garcom':
      return 'Garçom';
    default:
      return role;
  }
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

