import React from 'react';

const BarraBusqueda = ({ busqueda, setBusqueda, placeholder = "Buscar por nombre, unidad o propiedad..." }) => {
  return (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span className="text-gray-400">🔍</span>
      </div>
      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-bold transition-all shadow-sm"
        placeholder={placeholder}
      />
      {busqueda && (
        <button 
          onClick={() => setBusqueda('')}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-300 hover:text-gray-500"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default BarraBusqueda;