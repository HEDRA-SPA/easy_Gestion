import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import HistorialContratos from './HistorialContratos';
import FormularioRenovacionArchivo from './components/FormularioRenovacionArchivo';

const ArchivoInquilinos = ({ unidades }) => {
  const [todosInquilinos, setTodosInquilinos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [inquilinoSeleccionado, setInquilinoSeleccionado] = useState(null);
  const [todosContratos, setTodosContratos] = useState([]);
  const [contratoSeleccionado, setContratoSeleccionado] = useState(null);
  const [pagosDelContrato, setPagosDelContrato] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);
  const [mostrarModalRenovacion, setMostrarModalRenovacion] = useState(false);

  // 1. Cargar TODOS los inquilinos (activos e inactivos)
  useEffect(() => {
    const cargarInquilinos = async () => {
      try {
        const snap = await getDocs(collection(db, "inquilinos"));
        const inquilinos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Ordenar: primero inactivos, luego activos (alfabéticamente)
        inquilinos.sort((a, b) => {
          if (a.activo === b.activo) {
            return (a.nombre_completo || "").localeCompare(b.nombre_completo || "");
          }
          return a.activo ? 1 : -1; // Inactivos primero
        });
        
        setTodosInquilinos(inquilinos);
      } catch (error) {
        console.error("Error al cargar inquilinos:", error);
      }
    };
    cargarInquilinos();
  }, []);

  // 2. Cargar contratos del inquilino seleccionado
  useEffect(() => {
    const cargarContratos = async () => {
      if (!inquilinoSeleccionado) {
        setTodosContratos([]);
        setContratoSeleccionado(null);
        return;
      }

      setLoadingPagos(true);
      try {
        const q = query(
          collection(db, "contratos"),
          where("id_inquilino", "==", inquilinoSeleccionado.id)
        );
        
        const snap = await getDocs(q);
        const contratos = snap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        // Ordenar contratos por fecha de inicio (más reciente primero)
        contratos.sort((a, b) => {
          const fechaA = a.fecha_inicio?.seconds || 0;
          const fechaB = b.fecha_inicio?.seconds || 0;
          return fechaB - fechaA;
        });

        setTodosContratos(contratos);
        
        // Auto-seleccionar el primer contrato (el más reciente)
        if (contratos.length > 0) {
          setContratoSeleccionado(contratos[0]);
        } else {
          setContratoSeleccionado(null);
        }
      } catch (error) {
        console.error("Error al cargar contratos:", error);
        setTodosContratos([]);
      } finally {
        setLoadingPagos(false);
      }
    };

    cargarContratos();
  }, [inquilinoSeleccionado]);

  // 3. Cargar pagos del contrato seleccionado
  useEffect(() => {
    if (!contratoSeleccionado) {
      setPagosDelContrato([]);
      return;
    }

    const periodos = contratoSeleccionado.periodos_esperados || [];
    
    // Filtrar periodos válidos y ordenar
    const periodosValidos = periodos.filter(p => p.monto_esperado > 0);
    periodosValidos.sort((a, b) => b.periodo.localeCompare(a.periodo));
    
    setPagosDelContrato(periodosValidos);
  }, [contratoSeleccionado]);

  const filtrados = todosInquilinos.filter(inq => 
    (inq.nombre_completo || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const formatFecha = (timestamp) => {
    if (!timestamp) return "---";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'numeric', year: 'numeric' });
  };

  const getColorContrato = (index) => {
    const colores = [
      'from-blue-500 to-blue-600',      // Contrato actual
      'from-gray-500 to-gray-600',      // Contrato anterior 1
      'from-purple-500 to-purple-600',  // Contrato anterior 2
      'from-teal-500 to-teal-600',      // Contrato anterior 3
      'from-orange-500 to-orange-600',  // Contrato anterior 4
    ];
    return colores[index % colores.length];
  };

  const getBadgeContrato = (index) => {
    const badges = [
      { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Actual' },
      { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Anterior' },
      { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Histórico' },
      { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Histórico' },
      { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Histórico' },
    ];
    return badges[index % badges.length];
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER CON TÍTULO Y DESCRIPCIÓN */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl"><i className="fa-solid fa-users"></i></span>
              Historial Completo de Inquilinos
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Todos los inquilinos y su historial de contratos y pagos
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        
        {/* PANEL IZQUIERDO: BUSCADOR Y LISTA */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-[600px] lg:h-[750px] flex flex-col overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Filtro de búsqueda</p>
            <input 
              type="text"
              placeholder="Buscar inquilino..."
              className="w-full p-3 bg-white border rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        
          <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
            {filtrados.map(inq => {
              const estaActivo = inq.activo === true;
              
              return (
                <button
                  key={inq.id}
                  onClick={() => setInquilinoSeleccionado(inq)}
                  className={`w-full text-left p-4 sm:p-5 transition-all ${
                    inquilinoSeleccionado?.id === inq.id 
                    ? 'bg-blue-50 border-r-4 border-blue-600' 
                    : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-800 uppercase text-[11px] mb-1 truncate">
                        {inq.nombre_completo}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-bold uppercase">
                          {inq.id_unidad_actual || 'S/U'}
                        </span>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                          estaActivo 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {estaActivo ? '✓ Activo' : '⊗ Inactivo'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter whitespace-nowrap">
                      Ver →
                    </span>
                  </div>
                </button>
              );
            })}
            {filtrados.length === 0 && (
              <p className="p-10 text-center text-gray-400 text-xs italic">No se encontraron registros.</p>
            )}
          </div>

          {/* BOTÓN DE REACTIVACIÓN (solo si está inactivo) */}
          {inquilinoSeleccionado && !inquilinoSeleccionado.activo && (
            <div className="p-4 bg-gray-50 border-t">
              <button 
                onClick={() => setMostrarModalRenovacion(true)} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 sm:p-4 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                <span>🔄</span> Re-activar y Renovar
              </button>
            </div>
          )}
        </div>

        {/* PANEL DERECHO: DETALLES */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {inquilinoSeleccionado ? (
            <>
              {/* CARD PRINCIPAL: DATOS GENERALES */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-900 p-6 sm:p-8 text-white">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight truncate">
                        {inquilinoSeleccionado.nombre_completo}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">
                          Inquilino {inquilinoSeleccionado.activo ? 'Activo' : 'Histórico'}
                        </p>
                        {inquilinoSeleccionado.activo && (
                          <span className="bg-green-500 text-white text-[8px] px-2 py-1 rounded-full font-bold uppercase">
                            ● En Servicio
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md border border-white/20">
                      <p className="text-[8px] uppercase font-black opacity-60">
                        {inquilinoSeleccionado.activo ? 'Unidad Actual' : 'Última Unidad'}
                      </p>
                      <p className="text-lg font-black">{inquilinoSeleccionado.id_unidad_actual || 'S/U'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 border-b pb-2">
                        Información de Contacto
                      </h3>
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-gray-500">
                          Teléfono: <span className="text-gray-900 font-medium ml-2">{inquilinoSeleccionado.telefono_contacto || '---'}</span>
                        </p>
                        <p className="text-sm font-bold text-gray-500">
                          Emergencia: <span className="text-gray-900 font-medium ml-2">{inquilinoSeleccionado.telefono_emergencia || '---'}</span>
                        </p>
                      </div>
                    </section>

                    <section className={`p-4 rounded-2xl border ${
                      inquilinoSeleccionado.activo 
                        ? 'bg-green-50 border-green-100' 
                        : 'bg-red-50 border-red-100'
                    }`}>
                      <h3 className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                        inquilinoSeleccionado.activo ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Estatus del Perfil
                      </h3>
                      <p className={`text-xs italic font-medium leading-relaxed ${
                        inquilinoSeleccionado.activo ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {inquilinoSeleccionado.activo 
                          ? '"Inquilino activo con contrato vigente. Puede tener contratos históricos finalizados."'
                          : '"Contrato finalizado, el sistema ha liberado la unidad y este perfil está en modo lectura histórica."'
                        }
                      </p>
                    </section>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 border-b pb-2">
                      Historial de Contratos
                    </h3>
                    <HistorialContratos idInquilino={inquilinoSeleccionado.id} />
                  </div>
                </div>
              </div>

              {/* SELECTOR DE CONTRATOS Y TABLA DE PAGOS */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 sm:px-8 py-4 bg-gray-50 border-b">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Pagos por Contrato
                    </h3>
                    {loadingPagos && (
                      <span className="text-[10px] font-bold text-blue-500 animate-pulse">Cargando...</span>
                    )}
                  </div>
                </div>

                {/* SELECTOR DE CONTRATOS */}
                {todosContratos.length > 0 && (
                  <div className="p-4 bg-white border-b">
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-wider">
                      Seleccionar Contrato ({todosContratos.length} total)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {todosContratos.map((contrato, index) => {
                        const estaSeleccionado = contratoSeleccionado?.id === contrato.id;
                        const badge = getBadgeContrato(index);
                        const gradiente = getColorContrato(index);
                        const esActivo = contrato.estatus === 'activo';

                        return (
                          <button
                            key={contrato.id}
                            onClick={() => setContratoSeleccionado(contrato)}
                            className={`p-3 rounded-xl border-2 transition-all text-left ${
                              estaSeleccionado 
                                ? 'border-blue-500 bg-blue-50 shadow-md scale-105' 
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className={`text-[8px] px-2 py-1 rounded-full font-black uppercase ${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </span>
                              <span className={`text-[8px] px-2 py-1 rounded-full font-bold uppercase ${
                                esActivo 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {contrato.estatus.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[10px] font-black text-gray-700 mb-1 truncate">
                              {contrato.id}
                            </p>
                            <p className="text-[9px] text-gray-500">
                              {formatFecha(contrato.fecha_inicio)} - {formatFecha(contrato.fecha_fin)}
                            </p>
                            <div className={`mt-2 h-1 rounded-full bg-gradient-to-r ${gradiente}`}></div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TABLA DE PAGOS DEL CONTRATO SELECCIONADO */}
                {contratoSeleccionado && (
                  <>
                    {/* Vista Desktop - Tabla */}
                    <div className="hidden sm:block max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-white shadow-sm">
                          <tr className="text-[9px] font-black text-gray-400 uppercase">
                            <th className="p-5">Periodo</th>
                            <th className="p-5">Renta Base</th>
                            <th className="p-5">Estatus</th>
                            <th className="p-5">Monto Pagado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {pagosDelContrato.map((periodo, index) => {
                            const esPagado = periodo.estatus === 'pagado';
                            const esCondonado = periodo.metodo_condonacion === true;
                            const contratoIndex = todosContratos.findIndex(c => c.id === contratoSeleccionado.id);
                            const gradiente = getColorContrato(contratoIndex);

                            return (
                              <tr key={`${periodo.periodo}-${index}`} className="text-xs hover:bg-gray-50 transition-colors">
                                <td className="p-5">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1 h-8 rounded-full bg-gradient-to-b ${gradiente}`}></div>
                                    <span className="font-black text-blue-600">{periodo.periodo}</span>
                                  </div>
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
                                        : periodo.estatus === 'parcial'
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-red-100 text-red-700'
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

                    {/* Vista Mobile - Cards */}
                    <div className="sm:hidden max-h-[400px] overflow-y-auto p-4 space-y-3">
                      {pagosDelContrato.map((periodo, index) => {
                        const esPagado = periodo.estatus === 'pagado';
                        const esCondonado = periodo.metodo_condonacion === true;
                        const contratoIndex = todosContratos.findIndex(c => c.id === contratoSeleccionado.id);
                        const gradiente = getColorContrato(contratoIndex);

                        return (
                          <div key={`${periodo.periodo}-${index}`} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradiente}`}></div>
                            <div className="flex justify-between items-start mb-3 pl-3">
                              <div>
                                <p className="font-black text-blue-600 text-sm">{periodo.periodo}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Renta: <span className="font-bold text-gray-700">${Number(periodo.monto_esperado || 0).toLocaleString()}</span>
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded-md font-black text-[9px] uppercase ${
                                esCondonado 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : esPagado 
                                    ? 'bg-green-100 text-green-700' 
                                    : periodo.estatus === 'parcial'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-red-100 text-red-700'
                              }`}>
                                {esCondonado ? '🤝 COND' : periodo.estatus.toUpperCase()}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-gray-200 pl-3">
                              <p className="text-[10px] text-gray-500 mb-1">Monto Pagado:</p>
                              <p className={`text-lg font-black ${
                                esPagado || esCondonado ? 'text-blue-700' : 'text-gray-400'
                              }`}>
                                ${Number(periodo.monto_pagado || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {todosContratos.length === 0 && !loadingPagos && (
                  <div className="p-10 text-center">
                    <p className="text-gray-400 text-xs italic">No hay contratos registrados para este inquilino.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-[400px] lg:h-full flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-300 p-10 lg:p-20">
              <span className="text-6xl lg:text-8xl mb-6 opacity-20">📁</span>
              <p className="text-[11px] font-black uppercase tracking-[0.4em] mb-2 text-gray-400 text-center">
                Historial Completo
              </p>
              <p className="text-xs text-gray-400 opacity-60 text-center max-w-md">
                Selecciona un inquilino de la lista para ver su historial completo de contratos y pagos.
              </p>
            </div>
          )}

          {/* MODAL DE RENOVACIÓN */}
          {mostrarModalRenovacion && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="animate-in zoom-in-95 duration-200 w-full max-w-2xl">
                <FormularioRenovacionArchivo 
                  inquilino={inquilinoSeleccionado}
                  unidadesDisponibles={unidades}
                  onExito={() => {
                    setMostrarModalRenovacion(false);
                    setInquilinoSeleccionado(null);
                    window.location.reload();
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