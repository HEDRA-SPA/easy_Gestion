// src/components/Layout.jsx
import React from 'react';
import { obtenerPeriodoActual } from '../utils/dateUtils';

// src/components/Layout.jsx
const Layout = ({ children, setSeccion, seccionActiva }) => {
  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      
      <main className="max-w-7xl mx-auto px-4">
        {children}
      </main>
    </div>
  );
};

export default Layout;