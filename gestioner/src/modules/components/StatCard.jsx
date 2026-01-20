// src/modules/Dashboard/components/StatCard.jsx
import React from 'react';

const StatCard = ({ title, value, color }) => {
  // Si el valor es negativo y es la tarjeta de Pendiente, mostrar 0
  const esPendiente = title.includes("Pendiente");
  const valorAMostrar = (esPendiente && value < 0) ? 0 : value;
  const excedente = (esPendiente && value < 0) ? Math.abs(value) : 0;

  const colors = {
    blue: "bg-blue-50 border-blue-500 text-blue-600",
    green: "bg-green-50 border-green-500 text-green-600",
    red: "bg-red-50 border-red-500 text-red-600",
    amber: "bg-amber-50 border-amber-500 text-amber-600", // Color extra para excedentes
  };

  return (
    <div className={`${colors[color]} border-l-4 p-5 rounded-xl shadow-sm transition-all hover:shadow-md relative overflow-hidden`}>
      <div className="flex justify-between items-start">
        <div className="z-10">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{title}</p>
          <p className="text-3xl font-black mt-1">
            ${Number(valorAMostrar).toLocaleString()}
          </p>
          
          {/* Si hay un excedente (pago de más), mostrar esta etiqueta */}
          {excedente > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-green-700 uppercase bg-green-100 px-2 py-0.5 rounded-md">
                + ${excedente.toLocaleString()} Cobrado de más
              </span>
            </div>
          )}
        </div>

        <div className="text-4xl opacity-10 italic font-black absolute -right-2 -bottom-2 select-none">
          {title.includes("Esperado") && "📊"}
          {title.includes("Cobrado") && "💰"}
          {title.includes("Pendiente") && "⏳"}
        </div>
      </div>
    </div>
  );
};

export default StatCard;