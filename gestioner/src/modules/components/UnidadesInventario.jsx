import React, { useState } from 'react';
import { finalizarContrato } from '../../firebase/acciones';

const UnidadesInventario = ({ unidades = [], onAsignarInquilino, onRefrescar }) => {
  const [expandido, setExpandido] = useState(null);
  const [loading, setLoading] = useState(false); // Estado para evitar doble clic
  const toggleExpandir = (id) => {
    setExpandido(expandido === id ? null : id);
  };
  const handleFinalizar = async (unidad) => {
    if (window.confirm(`¿Finalizar contrato de ${unidad.nombre_inquilino}? La unidad quedará libre.`)) {
      setLoading(true);
      try {
        await finalizarContrato(unidad.id, unidad.id_inquilino, {
          fecha_inicio: unidad.fecha_inicio,
          fecha_fin: unidad.fecha_fin,
          renta_actual: unidad.renta_mensual,
          deposito_garantia: unidad.deposito_garantia
        });
        
        alert("✅ Contrato finalizado y movido al historial.");
        onRefrescar(); // Esto actualiza el Dashboard
      } catch (error) {
        console.error(error);
        alert("❌ Error al finalizar: " + error.message);
      } finally {
        setLoading(false);
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
              className={`bg-white rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                estaAbierto ? "border-blue-500 shadow-lg" : "border-gray-100 hover:border-gray-300"
              } ${esDisponible ? "opacity-70" : "opacity-100"}`}
            >
              {/* CABECERA (Clickable solo si NO está disponible) */}
              <div 
                onClick={() => !esDisponible && toggleExpandir(unidad.id)}
                className={`p-4 flex flex-wrap items-center justify-between transition-colors ${
                  !esDisponible ? "cursor-pointer hover:bg-gray-50" : "cursor-default"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center border-r pr-4">
                    <p className="text-[9px] text-gray-400 font-black uppercase">{unidad.id_propiedad}</p>
                    <p className="text-xl font-black text-gray-800">{unidad.id}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-bold text-gray-700">
                      {esDisponible ? "Unidad Libre" : unidad.nombre_inquilino}
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">
                      {esDisponible ? "Disponible para renta" : `Renta: $${unidad.renta_mensual?.toLocaleString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${
                    esDisponible ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                  }`}>
                    {unidad.estado}
                  </span>
                  {!esDisponible && (
                    <span className={`transition-transform duration-300 ${estaAbierto ? "rotate-180" : ""}`}>
                      ▼
                    </span>
                  )}
                </div>
              </div>
{esDisponible && (
  <button 
    onClick={(e) => {
      e.stopPropagation(); // Evita que se dispare el acordeón si no quieres
      onAsignarInquilino(unidad);
    }}
    className="mt-2 bg-green-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-green-700 transition-colors"
  >
    + Asignar Inquilino
  </button>
)}
              {/* CONTENIDO DESPLEGABLE (Solo se renderiza si NO está disponible) */}
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  estaAbierto ? "max-h-[500px] opacity-100 border-t" : "max-h-0 opacity-0"
                }`}
              >
                {!esDisponible && (
                  <div className="p-5 bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Columna 1: Contacto y Pagos */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase">Tel. Emergencia</p>
                        <p className="text-sm font-medium text-gray-700">{unidad.telefono_emergencia || "No asignado"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase text-red-500">Día de Pago</p>
                        <p className="text-sm font-bold text-gray-800">Día {unidad.dia_pago} de cada mes</p>
                      </div>
                    </div>

                    {/* Columna 2: Contrato y Depósito */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase">Vigencia</p>
                        <p className="text-xs text-gray-700 font-medium">
                          Del: {unidad.fecha_inicio} <br />
                          Al: {unidad.fecha_fin}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase">Depósito en Garantía</p>
                        <p className="text-sm font-bold text-green-600">${unidad.deposito_garantia?.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Columna 3: Documentación */}
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Expediente Digital</p>
                      <div className="grid grid-cols-1 gap-2">
                        {['INE', 'Carta', 'Contrato'].map(doc => {
                          const tieneDoc = unidad.docs?.[doc.toLowerCase()] === 'si';
                          return (
                            <div key={doc} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                              <span className="text-[10px] font-bold text-gray-600">{doc}</span>
                              <span className={`text-[10px] font-black ${tieneDoc ? "text-green-500" : "text-gray-300"}`}>
                                {tieneDoc ? "PDF LISTO ✓" : "PENDIENTE ✗"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="p-4 bg-red-50 border-t border-red-100 flex justify-end">
  <button
    disabled={loading}
    onClick={(e) => {
      e.stopPropagation();
      handleFinalizar(unidad);
    }}
    className={`bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm ${
      loading ? "opacity-50 cursor-not-allowed" : "hover:bg-red-600 hover:text-white"
    }`}
  >
    {loading ? "Procesando..." : "🚫 Finalizar Contrato"}
  </button>
</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnidadesInventario;