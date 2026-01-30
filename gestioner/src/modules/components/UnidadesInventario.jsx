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

  // --- LÓGICA MANTENIDA ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'propiedades'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activas = docs.filter(p => p.estado !== "Inactiva");
      setPropiedades(activas);
      if (activas.length > 0) {
        const existe = activas.find(p => p.id === propiedadSeleccionada);
        if (!propiedadSeleccionada || !existe) setPropiedadSeleccionada(activas[0].id);
      } else { setPropiedadSeleccionada(''); }
      setCargandoInicial(false);
    });
    return () => unsub();
  }, [propiedadSeleccionada]);

  useEffect(() => {
    if (!propiedadSeleccionada) { setUnidades([]); return; }
    const q = query(collection(db, 'unidades'), where("id_propiedad", "==", propiedadSeleccionada));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const visibles = docs.filter(u => u.estado !== "Clausurada");
      setUnidades(visibles.sort((a, b) => Number(a.no_depto) - Number(b.no_depto)));
    });
    return () => unsub();
  }, [propiedadSeleccionada]);

  const toggleExpandir = (id) => setExpandido(expandido === id ? null : id);

  const handleFinalizar = async (unidad) => {
    const { id, id_inquilino, id_contrato_actual, nombre_inquilino } = unidad;
    if (!id_contrato_actual) return;
    if (window.confirm(`¿Confirmas la salida de ${nombre_inquilino}?`)) {
      setLoadingAction(true);
      try {
        const res = await finalizarContrato(id, id_inquilino, id_contrato_actual);
        if (res.exito) { setExpandido(null); if (onRefrescar) onRefrescar(); }
      } catch (err) { console.error(err); } 
      finally { setLoadingAction(false); }
    }
  };

  if (cargandoInicial) return <div className="p-10 text-center text-slate-300">...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* SELECTOR ESTILO DASHBOARD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-2 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Gestión de Unidades</h2>
          <p className="text-slate-400 text-xs font-medium">Control de inventario y contratos activos</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-1 shadow-sm inline-flex items-center">
          <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-50">Propiedad</span>
          <select 
            value={propiedadSeleccionada}
            onChange={(e) => setPropiedadSeleccionada(e.target.value)}
            className="bg-transparent text-xs font-bold text-blue-600 outline-none px-3 py-1 cursor-pointer"
          >
            {propiedades.map(p => <option key={p.id} value={p.id}>{p.nombre.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {/* LISTADO "SOFT" - Estilo image_2e1874 */}
      <div className="space-y-3">
        {unidades.map((unidad) => {
          const esDisponible = unidad.estado === "Disponible";
          const estaAbierto = expandido === unidad.id;

          return (
            <div 
              key={unidad.id} 
              className={`bg-white border rounded-[1.5rem] transition-all duration-300 ${
                estaAbierto ? "border-blue-100 shadow-xl shadow-blue-50/50" : "border-slate-50 shadow-sm"
              }`}
            >
              <div 
                onClick={() => !esDisponible && toggleExpandir(unidad.id)}
                className={`p-5 flex items-center justify-between gap-4 ${!esDisponible ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-center gap-5">
                  {/* Número con diseño circular suave */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                    estaAbierto ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-slate-50 text-slate-400 border border-slate-100"
                  }`}>
                    {unidad.no_depto}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-[16px] font-bold tracking-tight transition-colors ${esDisponible ? "text-slate-300 italic font-medium" : "text-slate-800"}`}>
                        {esDisponible ? "Unidad disponible" : (unidad.nombre || unidad.nombre_inquilino)}
                      </h3>
                      {!esDisponible && (
                        <button onClick={(e) => { e.stopPropagation(); onEditarInquilino(unidad); }} className="text-slate-300 hover:text-blue-500 transition-colors">
                          <i className="fa-solid fa-pen-to-square text-[11px]"></i>
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      {esDisponible ? "Lista para nueva asignación" : `Renta Mensual: $${unidad.renta_mensual?.toLocaleString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Badge de estado estilo image_2e1874 */}
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                    esDisponible 
                      ? "bg-slate-50 text-slate-400 border border-slate-100" 
                      : "bg-blue-600 text-white shadow-md shadow-blue-100"
                  }`}>
                    {unidad.estado === "Ocupado" ? "Contrato Activo" : unidad.estado}
                  </span>
                  
                  {!esDisponible && (
                    <i className={`fa-solid fa-chevron-down text-slate-300 text-[10px] transition-transform duration-500 ${estaAbierto ? "rotate-180 text-blue-500" : ""}`}></i>
                  )}
                </div>
              </div>

              {/* CONTENIDO INTERNO - Estilo image_2cd92a pero más limpio */}
              {estaAbierto && !esDisponible && (
                <div className="border-t border-slate-50 bg-slate-50/30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="p-2">
                    <DetalleExpediente idInquilino={unidad.id_inquilino} />
                  </div>
                  
                  <div className="p-5 bg-white border-t border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); onVerPagos(unidad); }}
                      className="text-[11px] font-bold text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl transition-all border border-blue-50"
                    >
                      <i className="fa-solid fa-receipt mr-2"></i> Ver historial de pagos
                    </button>
                    
                    <button
                      disabled={loadingAction}
                      onClick={(e) => { e.stopPropagation(); handleFinalizar(unidad); }}
                      className="text-[11px] font-bold text-slate-300 hover:text-red-500 transition-colors uppercase tracking-widest"
                    >
                      {loadingAction ? "PROCESANDO..." : "Finalizar relación contractual"}
                    </button>
                  </div>
                </div>
              )}

              {esDisponible && (
                <div className="px-5 pb-5">
                  <button 
                    onClick={() => onAsignarInquilino(unidad)} 
                    className="flex items-center justify-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-[1rem] text-xs font-bold uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 w-full md:w-auto"
                  >
                    <i className="fa-solid fa-plus-circle text-sm"></i> Iniciar Contrato
                  </button>
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