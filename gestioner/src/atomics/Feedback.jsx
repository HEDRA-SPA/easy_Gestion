// src/components/common/Feedback.jsx
import React from 'react';

export const LoadingScreen = ({ mensaje = "Sincronizando..." }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
    <p className="text-gray-600 font-medium font-sans italic">{mensaje}</p>
  </div>
);

export const ErrorScreen = ({ mensaje = "Error de conexión" }) => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="bg-red-50 border border-red-200 p-6 rounded-xl shadow-lg text-center">
      <span className="text-4xl mb-2 block">❌</span>
      <p className="text-red-700 font-bold">{mensaje}</p>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 text-xs bg-red-600 text-white px-4 py-2 rounded-lg uppercase font-black"
      >
        Reintentar
      </button>
    </div>
  </div>
);