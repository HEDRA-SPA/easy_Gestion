import React, { useState, useMemo, useEffect } from 'react';
import StatCard from './components/StatCard';
import AdeudosTable from './components/AdeudosTable';
import UnidadesInventario from './components/UnidadesInventario';
import FormularioNuevoInquilino from './components/FormularioNuevoInquilino';
import ArchivoInquilinos from './ArchivoInquilinos';

const Dashboard = ({ resumen, adeudos, unidades, refrescarDatos, onVerPagos, periodoActual }) => {
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [vista, setVista] = useState('operacion');
  const [modoFiltro, setModoFiltro] = useState('mes');
  
  const [rangoFechas, setRangoFechas] = useState({
    inicio: typeof periodoActual === 'string' ? `${periodoActual}-01` : (periodoActual?.inicio || new Date().toISOString().split('T')[0]),
    fin: typeof periodoActual === 'string' ? `${periodoActual}-01` : (periodoActual?.fin || new Date().toISOString().split('T')[0])
  });

 // Dentro de Dashboard.jsx
useEffect(() => {
  const nuevoPeriodo = modoFiltro === 'mes' 
    ? rangoFechas.inicio.slice(0, 7) 
    : { inicio: rangoFechas.inicio, fin: rangoFechas.fin };

  // Evitamos disparar si el valor es el mismo que periodoActual (el que viene de App)
  // Convertimos a string para comparar fácil
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans">
      
      {/* NAVEGACIÓN */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-xl font-black text-gray-800 tracking-tighter uppercase italic">
          Gestioner <span className="text-blue-600 font-black">Pro</span>
        </h1>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setVista('operacion')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${vista === 'operacion' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>📊 Operación</button>
          <button onClick={() => setVista('archivo')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${vista === 'archivo' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>📁 Archivo</button>
        </div>
      </div>

      {vista === 'operacion' && (
        <>
          {/* FILTROS AUTOMÁTICOS */}
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
            {/* HEMOS QUITADO EL BOTÓN APLICAR AQUÍ */}
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
              const adeudosMes = adeudos.filter(a => a.periodo === mes);
              return (
                <div key={mes} className="animate-in fade-in slide-in-from-bottom-2">
                  <div className="inline-block bg-gray-900 text-white px-5 py-1.5 rounded-t-xl text-[10px] font-black uppercase border-b-2 border-blue-500">
                    Periodo: {mes}
                  </div>
                  <AdeudosTable 
                    adeudos={adeudosMes} 
                    periodo={mes} 
                    modoFiltro="mes" 
                  />
                </div>
              );
            })}
          </div>

          <UnidadesInventario 
            unidades={unidades} 
            onAsignarInquilino={(u) => { setModoEdicion(false); setUnidadSeleccionada(u); }} 
            onEditarInquilino={(u) => { setModoEdicion(true); setUnidadSeleccionada(u); }} 
            onVerPagos={onVerPagos} 
            onRefrescar={() => {
              // Si necesitas refrescar manualmente (ej. después de un pago)
              const param = modoFiltro === 'mes' ? rangoFechas.inicio.slice(0, 7) : rangoFechas;
              refrescarDatos(param);
            }} 
          />
        </>
      )}

      {/* MODAL */}
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
    </div>
  );
};

export default Dashboard;