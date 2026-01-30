import React from 'react';

const StatCard = ({ title, value, color, icon, trend, subtext }) => {
  // LÓGICA ORIGINAL INTACTA
  const esPendiente = title.includes("Pendiente");
  const valorAMostrar = (esPendiente && value < 0) ? 0 : value;
  const excedente = (esPendiente && value < 0) ? Math.abs(value) : 0;

  // Configuración de colores basada en la imagen (tonos pastel para el fondo del icono)
  const colorConfig = {
    blue: { bg: "bg-blue-50", icon: "text-blue-500", circle: "bg-blue-100" },
    green: { bg: "bg-green-50", icon: "text-green-600", circle: "bg-green-100" },
    red: { bg: "bg-red-50", icon: "text-red-500", circle: "bg-red-100" },
    amber: { bg: "bg-orange-50", icon: "text-orange-500", circle: "bg-orange-100" },
  };

  const theme = colorConfig[color] || colorConfig.blue;

  // Selector de Iconos Font Awesome basado en el título
  const getIcon = () => {
    if (title.includes("Esperado")) return "fa-chart-line";
    if (title.includes("Cobrado")) return "fa-hand-holding-dollar";
    if (title.includes("Pendiente")) return "fa-clock-rotate-left";
    return "fa-wallet";
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
      <div className="flex justify-between items-start">
        {/* Contenido de Texto */}
        <div className="flex-1">
          <p className="text-gray-500 text-sm font-medium mb-1 tracking-tight">
            {title}
          </p>
          
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-slate-800">
              ${Number(valorAMostrar).toLocaleString()}
            </h3>
            
            {/* Badge de tendencia (Opcional, similar a la imagen +5.7%) */}
            {trend && (
               <span className="text-[11px] font-bold text-green-500 flex items-center gap-0.5">
                  <i className="fa-solid fa-arrow-trend-up"></i> {trend}
               </span>
            )}
          </div>

          {/* Subtexto descriptivo */}
          {subtext && (
            <p className="text-gray-400 text-xs mt-1 font-medium">
              {subtext}
            </p>
          )}

          {/* LÓGICA DE EXCEDENTE ORIGINAL */}
          {excedente > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-green-700 uppercase bg-green-100 px-2 py-1 rounded-lg">
                + ${excedente.toLocaleString()} Cobrado de más
              </span>
            </div>
          )}
        </div>

        {/* Contenedor del Icono (Estilo circular de la imagen) */}
        <div className={`h-12 w-12 rounded-xl ${theme.circle} flex items-center justify-center transition-transform hover:scale-110`}>
          <i className={`fa-solid ${getIcon()} ${theme.icon} text-xl`}></i>
        </div>
      </div>
      
      {/* Decoración sutil de fondo para profundidad */}
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-8xl pointer-events-none">
        <i className={`fa-solid ${getIcon()}`}></i>
      </div>
    </div>
  );
};

export default StatCard;