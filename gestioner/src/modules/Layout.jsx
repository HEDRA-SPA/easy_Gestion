// src/components/Layout.jsx
import React from 'react';
import { obtenerPeriodoActual } from '../utils/dateUtils';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <nav className="bg-white shadow-sm p-4 mb-6 border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black text-blue-600 tracking-tighter italic">
            GESTION<span className="text-gray-800">ER</span>
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-100 px-3 py-1 rounded-full">
              Periodo: {obtenerPeriodoActual()}
            </span>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;