// src/modules/Dashboard/components/StatCard.jsx
import React from 'react';

const StatCard = ({ title, value, color }) => {
  const colors = {
    blue: "bg-blue-50 border-blue-500 text-blue-600",
    green: "bg-green-50 border-green-500 text-green-600",
    red: "bg-red-50 border-red-500 text-red-600",
  };

  return (
    <div className={`${colors[color]} border-l-4 p-5 rounded-xl shadow-sm transition-transform hover:scale-105`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-widest opacity-80">{title}</p>
          <p className="text-3xl font-black mt-1">
            ${Number(value).toLocaleString()}
          </p>
        </div>
        <div className="text-2xl opacity-30 italic font-black">
          {title.includes("Esperado") && "📊"}
          {title.includes("Cobrado") && "💰"}
          {title.includes("Pendiente") && "⏳"}
        </div>
      </div>
    </div>
  );
};

export default StatCard;