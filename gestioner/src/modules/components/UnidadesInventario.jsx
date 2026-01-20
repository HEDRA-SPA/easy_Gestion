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
  const [cargandoInicial, setCargandoInicial] = useState(true);

  // 1. Cargar catálogo de propiedades
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'propiedades'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activas = docs.filter(p => p.estado !== "Inactiva");
      
      setPropiedades(activas);

      if (activas.length > 0) {
        const existe = activas.find(p => p.id === propiedadSeleccionada);
        if (!propiedadSeleccionada || !existe) {
          setPropiedadSeleccionada(activas[0].id);
        }
      } else {
        setPropiedadSeleccionada('');
      }
      setCargandoInicial(false);
    });

    return () => unsub();
  }, [propiedadSeleccionada]);

  // 2. Cargar unidades
  useEffect(() => {
    if (!propiedadSeleccionada) {
      setUnidades([]);
      return;
    }

    const q = query(collection(db, 'unidades'), where("id_propiedad", "==", propiedadSeleccionada));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const visibles = docs.filter(u => u.estado !== "Clausurada");
      const ordenados = visibles.sort((a, b) => Number(a.no_depto) - Number(b.no_depto));
      setUnidades(ordenados);
    });

    return () => unsub();
  }, [propiedadSeleccionada]);

  const toggleExpandir = (id) => {
    setExpandido(expandido === id ? null : id);
  };

  const handleFinalizar = async (unidad) => {
    const { id, id_inquilino, id_contrato_actual, nombre_inquilino } = unidad;

    if (!id_contrato_actual) {
      alert("⚠️ Esta unidad no tiene un contrato vinculado.");
      return;
    }

    const confirmar = window.confirm(`¿Confirmas la salida de ${nombre_inquilino}? \n\n- El contrato se archivará.\n- La unidad quedará disponible.`);
    
    if (confirmar) {
      setLoadingAction(true);
      try {
        // ENVIAMOS LOS 3 DATOS CLAVE
        const res = await finalizarContrato(id, id_inquilino, id_contrato_actual);
        
        if (res.exito) {
          alert("✅ Contrato finalizado y unidad liberada con éxito.");
          setExpandido(null);
          if (onRefrescar) onRefrescar();
        } else {
          alert("❌ No se pudo finalizar: " + res.mensaje);
        }
      } catch (err) {
        alert("❌ Error crítico: " + err.message);
      } finally {
        setLoadingAction(false);
      }
    }
  };

  // --- RENDERIZADO DE ESTADO DE CARGA ---
  if (cargandoInicial) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-gray-400">
        <div className="animate-spin text-3xl mb-4">⏳</div>
        <p className="text-xs font-bold uppercase tracking-widest">Cargando Inventario...</p>
      </div>
    );
  }

  // --- RENDERIZADO SI NO HAY NADA EN LA BASE DE DATOS ---
  if (propiedades.length === 0) {
    return (
      <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
        <div className="text-5xl mb-4">🏗️</div>
        <h3 className="text-lg font-black text-gray-800 uppercase">No hay propiedades activas</h3>
        <p className="text-gray-500 text-sm max-w-xs mx-auto mt-2">
          Primero debes registrar un edificio en el módulo de <strong>Gestión de Propiedades</strong> para ver su inventario aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* SELECTOR DE PROPIEDAD */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2">
           <span className="text-lg">🏢</span>
           <h2 className="text-sm font-black text-gray-700 uppercase tracking-tighter">
             Inventario: {propiedades.find(p => p.id === propiedadSeleccionada)?.nombre || 'Selecciona...'}
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

      {/* LISTADO DE UNIDADES */}
      <div className="grid grid-cols-1 gap-4">
        {unidades.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-10 text-center border border-gray-100">
            <p className="text-gray-400 text-sm italic">
              Esta propiedad no tiene unidades registradas.
            </p>
          </div>
        ) : (
          unidades.map((unidad) => {
            const esDisponible = unidad.estado === "Disponible";
            const estaAbierto = expandido === unidad.id;

            return (
              <div 
                key={unidad.id} 
                className={`bg-white rounded-xl border-2 transition-all duration-300 ${
                  estaAbierto ? "border-blue-500 shadow-lg" : "border-gray-100 hover:border-gray-300"
                } ${esDisponible ? "opacity-75" : "opacity-100"}`}
              >
                <div 
                  onClick={() => !esDisponible && toggleExpandir(unidad.id)}
                  className={`p-4 flex flex-wrap items-center justify-between ${!esDisponible ? "cursor-pointer hover:bg-gray-50" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center border-r pr-4">
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
                            className="p-1 hover:bg-blue-100 rounded text-blue-500"
                          >✎</button>
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

                {esDisponible && (
                  <div className="px-4 pb-4">
                    <button 
                      onClick={() => onAsignarInquilino(unidad)} 
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-green-700 w-full md:w-auto shadow-sm"
                    >
                      + Asignar Inquilino
                    </button>
                  </div>
                )}

                {!esDisponible && (
                  <div className="px-4 pb-4 flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onVerPagos(unidad); }}
                      className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all text-[10px] font-bold border border-blue-100"
                    >
                      Ver Pagos
                    </button>
                  </div>
                )}

                {estaAbierto && !esDisponible && (
                  <div className="border-t animate-in slide-in-from-top-2 duration-300">
                    <DetalleExpediente idInquilino={unidad.id_inquilino} />
                    <div className="p-4 bg-red-50 border-t border-red-100 flex justify-end">
                      <button
                        disabled={loadingAction}
                        onClick={(e) => { e.stopPropagation(); handleFinalizar(unidad); }}
                        className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"
                      >
                        {loadingAction ? "Procesando..." : "🚫 Finalizar Contrato"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default UnidadesInventario;