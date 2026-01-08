import React, { useState } from 'react';
import { finalizarContrato } from '../../firebase/acciones';
import DetalleExpediente from './DetalleExpediente'; // Importamos el nuevo componente

const UnidadesInventario = ({ unidades = [], onAsignarInquilino, onEditarInquilino, onRefrescar, onVerPagos }) => {
  const [expandido, setExpandido] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const toggleExpandir = (id) => {
    setExpandido(expandido === id ? null : id);
  };

  const handleFinalizar = async (unidad) => {
    if (window.confirm(`¿Finalizar contrato de ${unidad.nombre_inquilino}? La unidad quedará libre.`)) {
      setLoadingAction(true);
      try {
        await finalizarContrato(unidad.id, unidad.id_inquilino, {
          fecha_inicio: unidad.fecha_inicio,
          fecha_fin: unidad.fecha_fin,
          renta_actual: unidad.renta_mensual,
          deposito_garantia: unidad.deposito_garantia
        });
        alert("✅ Contrato finalizado correctamente.");
        onRefrescar(); 
      } catch (error) {
        console.error(error);
        alert("❌ Error: " + error.message);
      } finally {
        setLoadingAction(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
        🏢 Control de Inventario
        <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full uppercase">
          {unidades.length} Unidades
        </span>
      </h2>

      <div className="grid grid-cols-1 gap-4">
        {unidades.map((unidad) => {
          const esDisponible = unidad.estado === "Disponible";
          const estaAbierto = expandido === unidad.id;

          return (
            <div 
              key={unidad.id} 
              className={`bg-white rounded-xl border-2 transition-all duration-300 ${
                estaAbierto ? "border-blue-500 shadow-lg" : "border-gray-100 hover:border-gray-300"
              } ${esDisponible ? "opacity-70" : "opacity-100"}`}
            >
              {/* CABECERA (Clickable) */}
              <div 
                onClick={() => !esDisponible && toggleExpandir(unidad.id)}
                className={`p-4 flex flex-wrap items-center justify-between ${!esDisponible ? "cursor-pointer hover:bg-gray-50" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center border-r pr-4">
                    <p className="text-[9px] text-gray-400 font-black uppercase">{unidad.id_propiedad}</p>
                    <p className="text-xl font-black text-gray-800">{unidad.no_depto || unidad.id}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-700">{esDisponible ? "Unidad Libre" : unidad.nombre_inquilino}</p>
                      {!esDisponible && (
                        <button onClick={(e) => { e.stopPropagation(); onEditarInquilino(unidad); }} className="p-1 hover:bg-blue-100 rounded text-blue-500">
                          ✎
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">
                      {esDisponible ? "Disponible para renta" : `Renta: $${unidad.renta_mensual?.toLocaleString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${esDisponible ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}>
                    {unidad.estado}
                  </span>
                  {!esDisponible && <span className={`transition-transform ${estaAbierto ? "rotate-180" : ""}`}>▼</span>}
                </div>
              </div>

              {esDisponible && (
                <div className="px-4 pb-4">
                  <button onClick={() => onAsignarInquilino(unidad)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-green-700 w-full md:w-auto">
                    + Asignar Inquilino
                  </button>
                </div>
              )}
              {!esDisponible && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onVerPagos(unidad); // Esta prop viene desde App -> Dashboard -> UnidadesInventario
    }}
    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all text-[10px] font-bold"
  >
    Ver Pagos
  </button>
)}
              {/* CONTENIDO DESPLEGABLE */}
              {estaAbierto && !esDisponible && (
                <div className="border-t animate-in slide-in-from-top-2 duration-300">
                  <DetalleExpediente idInquilino={unidad.id_inquilino} />
                  
                  <div className="p-4 bg-red-50 border-t border-red-100 flex justify-end">
                    <button
                      disabled={loadingAction}
                      onClick={(e) => { e.stopPropagation(); handleFinalizar(unidad); }}
                      className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                    >
                      {loadingAction ? "Procesando..." : "🚫 Finalizar Contrato"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnidadesInventario;