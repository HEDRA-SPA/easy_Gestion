// src/components/Layout.jsx
import React from 'react';
import { obtenerPeriodoActual } from '../utils/dateUtils';

// src/components/Layout.jsx
const Layout = ({ children, setSeccion, seccionActiva }) => {
  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <nav className="bg-white shadow-sm p-4 mb-6 border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-black text-blue-600 tracking-tighter italic mr-4">
              GESTION<span className="text-gray-800">ER</span>
            </h1>

            {/* BOTONES DE NAVEGACIÓN */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSeccion('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  seccionActiva === 'dashboard' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="text-sm">📊</span>
                <span className="text-[10px] font-black uppercase tracking-wider">Dashboard</span>
              </button>

              <button 
                onClick={() => setSeccion('propiedades')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  seccionActiva === 'propiedades' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="text-sm">🏢</span>
                <span className="text-[10px] font-black uppercase tracking-wider">Propiedades</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:block text-[10px] font-black text-gray-400 uppercase bg-gray-100 px-3 py-1 rounded-full">
              Periodo: {obtenerPeriodoActual()}
            </span>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto px-4">
        {children}
      </main>
    </div>
  );
};

export default Layout;