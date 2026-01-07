import React from 'react';

const UnidadesInventario = ({ unidades }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
        🏢 Estado General de Unidades 
        <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
          {unidades.length} Total
        </span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {unidades.map((unidad) => {
          const esDisponible = unidad.estado === "Disponible";
          
          return (
            <div 
              key={unidad.id} 
              className={`relative p-4 rounded-xl border-2 transition-all shadow-sm bg-white ${
                esDisponible 
                ? "border-dashed border-gray-200 opacity-80" 
                : "border-solid border-transparent hover:border-blue-400"
              }`}
            >
              {/* Badge de Estado */}
              <span className={`absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                esDisponible ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
              }`}>
                {unidad.estado}
              </span>

              {/* Info Principal */}
              <div className="mb-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {unidad.id_propiedad}
                </p>
                <p className={`text-2xl font-black ${esDisponible ? "text-gray-400" : "text-gray-800"}`}>
                  {unidad.id}
                </p>
              </div>

              {/* Info del Inquilino / Disponibilidad */}
              <div className="space-y-1 border-t pt-3">
                <p className="text-xs text-gray-500 flex justify-between">
                  <span className="font-medium text-gray-400">Inquilino:</span>
                  <span className="font-bold text-gray-700 truncate ml-2">
                    {esDisponible ? "—" : unidad.nombre_inquilino}
                  </span>
                </p>
                
                {!esDisponible && (
                  <p className="text-xs text-gray-500 flex justify-between">
                    <span className="font-medium text-gray-400">Límite pago:</span>
                    <span className="font-bold text-red-500">
                      Día {unidad.dia_pago || 5}
                    </span>
                  </p>
                )}
              </div>

              {/* Botón de acción rápida (opcional) */}
              {esDisponible && (
                <button className="w-full mt-4 py-2 text-[10px] font-black text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors uppercase">
                  Asignar Inquilino
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnidadesInventario;