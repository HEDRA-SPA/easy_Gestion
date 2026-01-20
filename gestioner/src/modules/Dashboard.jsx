import React, { useState, useMemo, useEffect } from 'react';
import StatCard from './components/StatCard';
import UnidadesInventario from './components/UnidadesInventario';
import FormularioNuevoInquilino from './components/FormularioNuevoInquilino';
import AdeudosTableConValidacion from './components/AdeudosTableConValidacion';
import { condonarDeuda } from '../firebase/consultas';
import ArchivoInquilinos from './ArchivoInquilinos';
import GestionPropiedades from './components/GestionPropiedades';
import BarraBusqueda from './components/BarraBusqueda';

// ⭐ Agregar inquilinosMap a los props
const Dashboard = ({ 
  resumen, 
  adeudos, 
  unidades, 
  inquilinosMap = {}, // ⭐ NUEVO PROP
  refrescarDatos, 
  onVerPagos, 
  periodoActual 
}) => {
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [vista, setVista] = useState('operacion');
  const [modoFiltro, setModoFiltro] = useState('mes');
  const [busqueda, setBusqueda] = useState('');
  
  const [rangoFechas, setRangoFechas] = useState({
    inicio: typeof periodoActual === 'string' ? `${periodoActual}-01` : (periodoActual?.inicio || new Date().toISOString().split('T')[0]),
    fin: typeof periodoActual === 'string' ? `${periodoActual}-01` : (periodoActual?.fin || new Date().toISOString().split('T')[0])
  });
const adeudosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return adeudos;
    const term = busqueda.toLowerCase();

    return adeudos.filter(a => {
      // 1. Datos directos del adeudo
      const nombreInq = (a.nombre || "").toLowerCase();
      const idUnidad = (a.id_unidad || "").toLowerCase();
      
      // 2. Datos cruzados (si la propiedad viene en el objeto adeudo)
      const nombreProp = (a.nombre_propiedad || "").toLowerCase();

      return nombreInq.includes(term) || 
             idUnidad.includes(term) || 
             nombreProp.includes(term);
    });
  }, [adeudos, busqueda]);
 const unidadesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return unidades;
    const term = busqueda.toLowerCase();

    return unidades.filter(u => {
      const idUnidad = (u.id || "").toLowerCase();
      const nombreProp = (u.nombre_propiedad || "").toLowerCase();
      
      // Buscamos en el nombre del inquilino usando el mapa que ya tenemos
      const infoInquilino = inquilinosMap[u.id_inquilino];
      const nombreInq = (infoInquilino?.nombre_completo || "").toLowerCase();
      
      return idUnidad.includes(term) || 
             nombreProp.includes(term) || 
             nombreInq.includes(term);
    });
  }, [unidades, busqueda, inquilinosMap]);
  useEffect(() => {
    const nuevoPeriodo = modoFiltro === 'mes' 
      ? rangoFechas.inicio.slice(0, 7) 
      : { inicio: rangoFechas.inicio, fin: rangoFechas.fin };

    const pActualStr = JSON.stringify(periodoActual);
    const pNuevoStr = JSON.stringify(nuevoPeriodo);

    if (pActualStr !== pNuevoStr) {
      refrescarDatos(nuevoPeriodo);
    }
  }, [modoFiltro, rangoFechas.inicio, rangoFechas.fin, refrescarDatos, periodoActual]);

  const listaMeses = useMemo(() => {
    if (modoFiltro === 'mes') return [rangoFechas.inicio.slice(0, 7)];
    
    const inicio = new Date(rangoFechas.inicio + "T00:00:00");
    const fin = new Date(rangoFechas.fin + "T00:00:00");
    const meses = [];
    let actual = new Date(inicio.getFullYear(), inicio.getMonth(), 1);

    while (actual <= fin) {
      meses.push(actual.toISOString().slice(0, 7));
      actual.setMonth(actual.getMonth() + 1);
    }
    return meses;
  }, [modoFiltro, rangoFechas.inicio, rangoFechas.fin]);

  const handleCondonarDeuda = async (adeudo, motivo) => {
    const resultado = await condonarDeuda(adeudo, motivo);
    
    if (resultado.exito) {
      alert('✅ Deuda condonada exitosamente');
      const param = modoFiltro === 'mes' ? rangoFechas.inicio.slice(0, 7) : rangoFechas;
      refrescarDatos(param);
    } else {
      alert('❌ Error al condonar: ' + resultado.error);
    }
  };

 return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans">
      
      {/* NAVEGACIÓN Y BÚSQUEDA */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <h1 className="text-xl font-black text-gray-800 tracking-tighter uppercase italic">
          Gestioner <span className="text-blue-600 font-black">Pro</span>
        </h1>

        {/* Componente Modular de Búsqueda */}
        <BarraBusqueda busqueda={busqueda} setBusqueda={setBusqueda} />

        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setVista('operacion')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${vista === 'operacion' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>📊 Operación</button>
          <button onClick={() => setVista('archivo')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${vista === 'archivo' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>📁 Archivo</button>
        </div>
      </div>

      {vista === 'operacion' && (
        <>
          {/* FILTROS DE FECHA */}
          <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-2xl border border-gray-100 shadow-sm w-fit">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Visualización</span>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setModoFiltro('mes')} className={`px-4 py-2 text-[10px] font-black rounded-md transition-all ${modoFiltro === 'mes' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>MES</button>
                <button onClick={() => setModoFiltro('rango')} className={`px-4 py-2 text-[10px] font-black rounded-md transition-all ${modoFiltro === 'rango' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>RANGO</button>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 min-h-[52px]">
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-gray-400 uppercase">Inicio</span>
                <input type="date" value={rangoFechas.inicio} onChange={(e) => setRangoFechas({...rangoFechas, inicio: e.target.value})} className="text-sm font-bold bg-transparent outline-none text-blue-600"/>
              </div>
              
              {modoFiltro === 'rango' && (
                <>
                  <span className="text-gray-300">/</span>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-gray-400 uppercase">Fin</span>
                    <input type="date" value={rangoFechas.fin} onChange={(e) => setRangoFechas({...rangoFechas, fin: e.target.value})} className="text-sm font-bold bg-transparent outline-none text-blue-600"/>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Ingreso Esperado" value={resumen.esperado} color="blue" />
            <StatCard title="Cobrado" value={resumen.pagado} color="green" />
            <StatCard title="Pendiente" value={resumen.adeudo} color="red" />
          </div>

          {/* TABLAS POR MES */}
          <div className="space-y-12">
            {listaMeses.map((mes) => {
              // ⭐ Filtramos del array ya filtrado por búsqueda
              const adeudosMes = adeudosFiltrados.filter(a => a.periodo === mes);
              
              // Ocultar el periodo si la búsqueda no arroja resultados para ese mes
              if (busqueda && adeudosMes.length === 0) return null;

              return (
                <div key={mes} className="animate-in fade-in slide-in-from-bottom-2">
                  <div className="inline-block bg-gray-900 text-white px-5 py-1.5 rounded-t-xl text-[10px] font-black uppercase border-b-2 border-blue-500">
                    Periodo: {mes}
                  </div>
                  <AdeudosTableConValidacion 
                    adeudos={adeudosMes} 
                    periodo={mes} 
                    modoFiltro="mes"
                    onCondonar={handleCondonarDeuda}
                    inquilinosMap={inquilinosMap}
                  />
                </div>
              );
            })}
            
            {/* Mensaje si la búsqueda en adeudos es vacía */}
            {busqueda && adeudosFiltrados.length === 0 && (
              <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 italic text-sm">
                No se encontraron adeudos que coincidan con "{busqueda}"
              </div>
            )}
          </div>

          {/* INVENTARIO (Con unidades filtradas) */}
          <UnidadesInventario 
            unidades={unidadesFiltradas} 
            onAsignarInquilino={(u) => { setModoEdicion(false); setUnidadSeleccionada(u); }} 
            onEditarInquilino={(u) => { setModoEdicion(true); setUnidadSeleccionada(u); }} 
            onVerPagos={onVerPagos} 
            onRefrescar={() => {
              const param = modoFiltro === 'mes' ? rangoFechas.inicio.slice(0, 7) : rangoFechas;
              refrescarDatos(param);
            }} 
          />
        </>
      )}

      {vista === 'archivo' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ArchivoInquilinos unidades={unidadesFiltradas} />
        </div>
      )}

      {/* MODAL FORMULARIO */}
      {unidadSeleccionada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
            <FormularioNuevoInquilino 
               unidad={unidadSeleccionada} 
               esEdicion={modoEdicion} 
               onExito={() => {
                 setUnidadSeleccionada(null);
                 const param = modoFiltro === 'mes' ? rangoFechas.inicio.slice(0, 7) : rangoFechas;
                 refrescarDatos(param);
               }} 
               onCancelar={() => setUnidadSeleccionada(null)} 
            />
          </div>
        </div>
      )}
      
      <GestionPropiedades/>
    </div>
  );
};

export default Dashboard;