import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { finalizarContrato } from '../../firebase/acciones';
import DetalleExpediente from './DetalleExpediente';

const UnidadesInventario = ({ onAsignarInquilino, onEditarInquilino, onRefrescar, onVerPagos }) => {
  const [propiedades, setPropiedades] = useState([]);
  const [propiedadSeleccionada, setPropiedadSeleccionada] = useState('');
  const [unidades, setUnidades] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
// 1. Cargar catálogo de propiedades (Sin filtros de Firebase para evitar errores)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'propiedades'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filtramos las inactivas aquí en JS para que no se rompa nada
      const activas = docs.filter(p => p.estado !== "Inactiva");
      
      setPropiedades(activas);

      // Si hay propiedades y no hay selección, o la selección ya no es válida
      if (activas.length > 0) {
        const existe = activas.find(p => p.id === propiedadSeleccionada);
        if (!propiedadSeleccionada || !existe) {
          setPropiedadSeleccionada(activas[0].id);
        }
      } else {
        setPropiedadSeleccionada('');
      }
    });

    return () => unsub();
  }, [propiedadSeleccionada]);

  // 2. Cargar unidades de la propiedad elegida
  useEffect(() => {
    if (!propiedadSeleccionada) {
      setUnidades([]);
      return;
    }

    // Consulta simple por ID de propiedad
    const q = query(collection(db, 'unidades'), where("id_propiedad", "==", propiedadSeleccionada));

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filtramos las clausuradas en JS
      const visibles = docs.filter(u => u.estado !== "Clausurada");
      
      const ordenados = visibles.sort((a, b) => Number(a.no_depto) - Number(b.no_depto));
      setUnidades(ordenados);
    }, (error) => {
      console.error("Error cargando unidades:", error);
    });

    return () => unsub();
  }, [propiedadSeleccionada]);
  const toggleExpandir = (id) => {
    setExpandido(expandido === id ? null : id);
  };

  const handleFinalizar = async (unidad) => {
    if (window.confirm(`¿Finalizar contrato de ${unidad.nombre_inquilino}?`)) {
      setLoadingAction(true);
      try {
        await finalizarContrato(unidad.id, unidad.id_inquilino);
        alert("✅ Contrato finalizado.");
        onRefrescar(); 
      } catch (error) {
        alert("❌ Error: " + error.message);
      } finally {
        setLoadingAction(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* SELECTOR DE PROPIEDAD ESTILO TAB */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2">
           <span className="text-lg">🏢</span>
           <h2 className="text-sm font-black text-gray-700 uppercase tracking-tighter">
             Inventario: {propiedades.find(p => p.id === propiedadSeleccionada)?.nombre || '...'}
           </h2>
        </div>
        
        <select 
          value={propiedadSeleccionada}
          onChange={(e) => setPropiedadSeleccionada(e.target.value)}
          className="bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-bold rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
        >
          {propiedades.map(p => (
            <option key={p.id} value={p.id}>{p.nombre.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {unidades.map((unidad) => {
          const esDisponible = unidad.estado === "Disponible";
          const estaAbierto = expandido === unidad.id;

          return (
            <div 
              key={unidad.id} 
              className={`bg-white rounded-xl border-2 transition-all duration-300 ${
                estaAbierto ? "border-blue-500 shadow-lg" : "border-gray-100 hover:border-gray-300"
              } ${esDisponible ? "opacity-75" : "opacity-100"}`}
            >
              {/* CABECERA (Clickable) */}
              <div 
                onClick={() => !esDisponible && toggleExpandir(unidad.id)}
                className={`p-4 flex flex-wrap items-center justify-between ${!esDisponible ? "cursor-pointer hover:bg-gray-50" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center border-r pr-4">
                    {/* Aquí mostramos el ID de la unidad (ej: CH-1) */}
                    <p className="text-[9px] text-blue-500 font-black uppercase">{unidad.id_unidad || unidad.id}</p>
                    <p className="text-xl font-black text-gray-800">#{unidad.no_depto}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-700">
                        {esDisponible ? "Unidad Libre" : unidad.nombre_inquilino}
                      </p>
                      {!esDisponible && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onEditarInquilino(unidad); }} 
                          className="p-1 hover:bg-blue-100 rounded text-blue-500 transition-colors"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">
                      {esDisponible ? "Disponible para renta" : `Renta: $${unidad.renta_mensual?.toLocaleString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${
                    esDisponible ? "bg-green-100 text-green-600 border border-green-200" : "bg-blue-100 text-blue-600 border border-blue-200"
                  }`}>
                    {unidad.estado}
                  </span>
                  {!esDisponible && (
                    <span className={`text-gray-400 transition-transform duration-300 ${estaAbierto ? "rotate-180" : ""}`}>
                      ▼
                    </span>
                  )}
                </div>
              </div>

              {/* ACCIONES PARA UNIDAD DISPONIBLE */}
              {esDisponible && (
                <div className="px-4 pb-4">
                  <button 
                    onClick={() => onAsignarInquilino(unidad)} 
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-green-700 w-full md:w-auto transition-all shadow-sm shadow-green-100"
                  >
                    + Asignar Inquilino
                  </button>
                </div>
              )}

              {/* BOTÓN VER PAGOS (Solo si está ocupado) */}
              {!esDisponible && (
                <div className="px-4 pb-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onVerPagos(unidad);
                    }}
                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all text-[10px] font-bold border border-blue-100"
                  >
                    Ver Pagos
                  </button>
                </div>
              )}

              {/* CONTENIDO DESPLEGABLE (Detalles del Inquilino) */}
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