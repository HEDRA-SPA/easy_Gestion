import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import HistorialContratos from './HistorialContratos';
import FormularioRenovacionArchivo from './components/FormularioRenovacionArchivo';
const ArchivoInquilinos = ({ unidades }) => {
  const [exInquilinos, setExInquilinos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [inquilinoSeleccionado, setInquilinoSeleccionado] = useState(null);
  const [pagosHistoricos, setPagosHistoricos] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);
const [mostrarModalRenovacion, setMostrarModalRenovacion] = useState(false);
  // 1. Cargar lista de ex-inquilinos
  useEffect(() => {
    const cargarArchivo = async () => {
      try {
        const q = query(collection(db, "inquilinos"), where("activo", "==", false));
        const snap = await getDocs(q);
        setExInquilinos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error al cargar archivo:", error);
      }
    };
    cargarArchivo();
  }, []);
useEffect(() => {
  const cargarPeriodosHistoricos = async () => {
    if (!inquilinoSeleccionado) return;
    setLoadingPagos(true);
    try {
      const q = query(
        collection(db, "contratos"),
        where("id_inquilino", "==", inquilinoSeleccionado.id)
      );
      
      const snap = await getDocs(q);
      
      // Usaremos un Mapa para que el periodo sea la CLAVE ÚNICA
      const mapaPeriodos = {};

      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.periodos_esperados) {
          data.periodos_esperados.forEach(p => {
            const key = p.periodo;
            
            // LOGICA DE FILTRADO:
            // 1. Si no existe el periodo en el mapa, lo agregamos.
            // 2. Si ya existe pero el nuevo tiene estatus 'pagado', lo sobrescribimos.
            // 3. Ignoramos los que no tengan monto esperado (basura de datos).
            if (!mapaPeriodos[key] || (p.estatus === 'pagado' && mapaPeriodos[key].estatus !== 'pagado')) {
              if (p.monto_esperado > 0) {
                 mapaPeriodos[key] = p;
              }
            }
          });
        }
      });

      // Convertir el mapa de nuevo a un array y ordenar
      const listaLimpia = Object.values(mapaPeriodos);
      listaLimpia.sort((a, b) => b.periodo.localeCompare(a.periodo));
      
      setPagosHistoricos(listaLimpia);
    } catch (error) {
      console.error("Error al cargar periodos:", error);
      setPagosHistoricos([]);
    } finally {
      setLoadingPagos(false);
    }
  };

  cargarPeriodosHistoricos();
}, [inquilinoSeleccionado]);

  const filtrados = exInquilinos.filter(inq => 
    (inq.nombre_completo || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-500">
       {/* HEADER CON TÍTULO Y DESCRIPCIÓN */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl"><i class="fa-solid fa-users"></i></span>
              Archivo de Inquilinos Históricos
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Inquilinos con contratos finalizados y su historial de pagos
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: BUSCADOR Y LISTA */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-[750px] flex flex-col overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Filtro de búsqueda</p>
            <input 
              type="text"
              placeholder="Nombre del ex-inquilino..."
              className="w-full p-3 bg-white border rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        
          <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
            {filtrados.map(inq => (
              <button
                key={inq.id}
                onClick={() => setInquilinoSeleccionado(inq)}
                className={`w-full text-left p-5 transition-all ${
                  inquilinoSeleccionado?.id === inq.id 
                  ? 'bg-blue-50 border-r-4 border-blue-600' 
                  : 'hover:bg-gray-50'
                }`}
              >
                <p className="font-black text-gray-800 uppercase text-[11px] mb-1">{inq.nombre_completo}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-bold uppercase">
                    ID: {inq.id_unidad_actual || 'S/U'}
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                    Ver Expediente →
                  </span>
                </div>
              </button>
            ))}
            {filtrados.length === 0 && (
              <p className="p-10 text-center text-gray-400 text-xs italic">No se encontraron registros.</p>
            )}
           {inquilinoSeleccionado && (
            <div className="p-4 bg-gray-50 border-t">
              <button 
                onClick={() => setMostrarModalRenovacion(true)} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                <span>🔄</span> Re-activar y Renovar
              </button>
            </div>
          )}
          </div>
        </div>

        {/* PANEL DERECHO: DETALLES */}
        <div className="md:col-span-2 space-y-6">
          {inquilinoSeleccionado ? (
            <>
              {/* CARD PRINCIPAL: DATOS GENERALES */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-900 p-8 text-white flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{inquilinoSeleccionado.nombre_completo}</h2>
                    <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Inquilino Histórico Finalizado</p>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md border border-white/20">
                    <p className="text-[8px] uppercase font-black opacity-60">Último ID Unidad</p>
                    <p className="text-lg font-black">{inquilinoSeleccionado.id_unidad_actual || 'OT-01'}</p>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 border-b pb-2">Información de Contacto</h3>
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-gray-500">Teléfono: <span className="text-gray-900 font-medium ml-2">{inquilinoSeleccionado.telefono_contacto || '---'}</span></p>
                        <p className="text-sm font-bold text-gray-500">Emergencia: <span className="text-gray-900 font-medium ml-2">{inquilinoSeleccionado.telefono_emergencia || '---'}</span></p>
                      </div>
                    </section>

                    <section className="bg-red-50 p-4 rounded-2xl border border-red-100">
                      <h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Estatus de Salida</h3>
                      <p className="text-xs text-red-800 italic font-medium leading-relaxed">
                        "Contrato finalizado el sistema ha liberado la unidad y este perfil ha pasado a modo lectura histórica."
                      </p>
                    </section>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 border-b pb-2">Historial de Contratos</h3>
                    <HistorialContratos idInquilino={inquilinoSeleccionado.id} />
                  </div>
                </div>
              </div>

              {/* TABLA DE PAGOS HISTÓRICOS */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-8 py-4 bg-gray-50 border-b flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Auditoría de Pagos Realizados</h3>
                  {loadingPagos && <span className="text-[10px] font-bold text-blue-500 animate-pulse">Cargando...</span>}
                </div>
                
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white shadow-sm">
                      <tr className="text-[9px] font-black text-gray-400 uppercase">
                        <th className="p-5">Periodo</th>
                        <th className="p-5">Renta Base</th>
                        <th className="p-5">Servicios</th>
                        <th className="p-5">Monto Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
  {pagosHistoricos.map((periodo, index) => {
    const esPagado = periodo.estatus === 'pagado';
    const esCondonado = periodo.metodo_condonacion === true;

    return (
      <tr key={`${periodo.periodo}-${index}`} className="text-xs hover:bg-gray-50 transition-colors">
        <td className="p-5 font-black text-blue-600">
          {periodo.periodo}
        </td>
        <td className="p-5 text-gray-600 font-bold">
          ${Number(periodo.monto_esperado || 0).toLocaleString()}
        </td>
        <td className="p-5">
          <span className={`px-2 py-1 rounded-md font-black text-[9px] uppercase ${
            esCondonado 
              ? 'bg-purple-100 text-purple-700' 
              : esPagado 
                ? 'bg-green-100 text-green-700' 
                : 'bg-amber-100 text-amber-700'
          }`}>
            {esCondonado ? '🤝 CONDONADO' : periodo.estatus.toUpperCase()}
          </span>
        </td>
        <td className="p-5">
          <span className={`px-3 py-1.5 rounded-lg font-black ${
            esPagado || esCondonado ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'
          }`}>
            ${Number(periodo.monto_pagado || 0).toLocaleString()}
          </span>
        </td>
      </tr>
    );
  })}
</tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-300 p-20">
              <span className="text-8xl mb-6 opacity-20">📁</span>
              <p className="text-[11px] font-black uppercase tracking-[0.4em] mb-2 text-gray-400">Expedientes de Archivo</p>
              <p className="text-xs text-gray-400 opacity-60">Selecciona un registro de la lista lateral para auditar sus contratos y pagos pasados.</p>
            </div>
          )}
          {mostrarModalRenovacion && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="animate-in zoom-in-95 duration-200">
            <FormularioRenovacionArchivo 
              inquilino={inquilinoSeleccionado}
              unidadesDisponibles={unidades} // Le pasamos las unidades para el select
              onExito={() => {
                setMostrarModalRenovacion(false);
                setInquilinoSeleccionado(null);
                // Aquí podrías disparar un refrescar general si es necesario
                window.location.reload(); // Opción simple para refrescar estados globales
              }}
              onCancelar={() => setMostrarModalRenovacion(false)}
            />
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default ArchivoInquilinos;