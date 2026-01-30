import React, { useState, useMemo } from 'react';
import StatCard from './components/StatCard';
import UnidadesInventario from './components/UnidadesInventario';
import FormularioNuevoInquilino from './components/FormularioNuevoInquilino';
import AdeudosTableConValidacion from './components/AdeudosTableConValidacion';
import EstadoCuenta from './components/EstadoCuenta';
import { condonarDeuda } from '../firebase/consultas';
import ArchivoInquilinos from './ArchivoInquilinos';
import GestionPropiedades from './components/GestionPropiedades';
import MantenimientoForm from './components/MantenimientoForm';
import MantenimientoLista from './components/MantenimientoLista';
import ServiciosDashboard from './components/ServiciosDashboard';
import ReporteFinancieroGlobal from './components/Reportefinancieroglobal';

const Dashboard = ({ 
  resumen, 
  adeudos, 
  unidades, 
  inquilinosMap = {},
  refrescarDatos, 
  onVerPagos, 
  periodoActual 
}) => {
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [vista, setVista] = useState('operacion');
  const [modoFiltro, setModoFiltro] = useState('mes');
  const [sidebarAbierto, setSidebarAbierto] = useState(false); // Cerrado por defecto en mobile
  
  const [rangoFechas, setRangoFechas] = useState({
    inicio: typeof periodoActual === 'string' ? `${periodoActual}-01` : (periodoActual?.inicio || new Date().toISOString().split('T')[0]),
    fin: typeof periodoActual === 'string' ? `${periodoActual}-01` : (periodoActual?.fin || new Date().toISOString().split('T')[0])
  });

  const listaMeses = useMemo(() => {
    if (typeof periodoActual === 'string') {
      return [periodoActual];
    }
    
    if (periodoActual?.inicio && periodoActual?.fin) {
      const inicio = new Date(periodoActual.inicio + "T00:00:00");
      const fin = new Date(periodoActual.fin + "T00:00:00");
      const meses = [];
      let actual = new Date(inicio.getFullYear(), inicio.getMonth(), 1);

      while (actual <= fin) {
        meses.push(actual.toISOString().slice(0, 7));
        actual.setMonth(actual.getMonth() + 1);
      }
      return meses;
    }
    
    return [new Date().toISOString().slice(0, 7)];
  }, [periodoActual]);

  const handleBuscar = () => {
    const nuevoPeriodo = modoFiltro === 'mes' 
      ? rangoFechas.inicio.slice(0, 7) 
      : { inicio: rangoFechas.inicio, fin: rangoFechas.fin };
    
    refrescarDatos(nuevoPeriodo);
  };

  const handleCondonarDeuda = async (adeudo, motivo) => {
    const resultado = await condonarDeuda(adeudo, motivo);
    
    if (resultado.exito) {
      alert('✅ Deuda condonada exitosamente');
      handleBuscar();
    } else {
      alert('❌ Error al condonar: ' + resultado.error);
    }
  };

  const menuItems = [
    { id: 'operacion', icon: 'fas fa-chart-area', label: 'Operación' },
    { id: 'estado-cuenta', icon: 'fas fa-file-alt', label: 'Estado Cuenta' },
    { id: 'archivo', icon: 'fas fa-folder', label: 'Archivo' },
    { id: 'mantenimiento-form', icon: 'fas fa-wrench', label: 'Nuevo Mant.' },
    { id: 'mantenimiento-lista', icon: 'fas fa-list', label: 'Historial' },
    { id: 'servicios-dashboard', icon: 'fas fa-tint', label: 'Servicios' },
    { id: 'reporte-financiero', icon: 'fas fa-money-bill', label: 'Reporte Fin.' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* OVERLAY MOBILE */}
      {sidebarAbierto && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarAbierto(false)}
        />
      )}

      {/* SIDEBAR */}
      <div 
        className={`fixed left-0 top-0 h-full bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl transition-all duration-300 z-50 
          ${sidebarAbierto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:${sidebarAbierto ? 'w-64' : 'w-16'}
          w-64
        `}
      >
        {/* HEADER */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h1 className={`text-lg font-black text-white tracking-tighter uppercase italic transition-opacity duration-300 ${
              !sidebarAbierto ? 'lg:opacity-0 lg:hidden' : 'opacity-100'
            }`}>
              Gestion<span className="text-blue-400">er</span>
            </h1>
            <button
              onClick={() => setSidebarAbierto(!sidebarAbierto)}
              className="p-2 rounded-lg hover:bg-slate-700/50 text-white transition-all hidden lg:block"
            >
              {sidebarAbierto ? '◀' : '▶'}
            </button>
            <button
              onClick={() => setSidebarAbierto(false)}
              className="p-2 rounded-lg hover:bg-slate-700/50 text-white transition-all lg:hidden"
            >
              ✕
            </button>
          </div>
        </div>

        {/* MENU ITEMS */}
        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100%-80px)]">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setVista(item.id);
                // Cerrar sidebar en mobile después de seleccionar
                if (window.innerWidth < 1024) {
                  setSidebarAbierto(false);
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                vista === item.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <span className="text-xl flex-shrink-0"><i className={item.icon}></i></span>
              <span className={`text-xs font-bold uppercase tracking-wide truncate transition-opacity duration-300 ${
                !sidebarAbierto ? 'lg:opacity-0 lg:hidden' : 'opacity-100'
              }`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div 
        className={`flex-1 transition-all duration-300 
          lg:${sidebarAbierto ? 'ml-64' : 'ml-16'}
          ml-0
        `}
      >
        {/* BOTÓN HAMBURGUESA MOBILE */}
        <button
          onClick={() => setSidebarAbierto(true)}
          className="fixed top-4 left-4 z-30 p-3 bg-slate-800 text-white rounded-xl shadow-lg lg:hidden hover:bg-slate-700 transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="p-6 max-w-7xl mx-auto space-y-8 overflow-y-auto h-screen pt-20 lg:pt-6">
          
          {vista === 'operacion' && (
            <>
              {/* FILTROS */}
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
                    <input 
                      type="date" 
                      value={rangoFechas.inicio} 
                      onChange={(e) => setRangoFechas({...rangoFechas, inicio: e.target.value})} 
                      className="text-sm font-bold bg-transparent outline-none text-blue-600"
                    />
                  </div>
                  
                  {modoFiltro === 'rango' && (
                    <>
                      <span className="text-gray-300">/</span>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-gray-400 uppercase">Fin</span>
                        <input 
                          type="date" 
                          value={rangoFechas.fin} 
                          onChange={(e) => setRangoFechas({...rangoFechas, fin: e.target.value})} 
                          className="text-sm font-bold bg-transparent outline-none text-blue-600"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button 
                  onClick={handleBuscar}
                  className="px-6 py-3 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  🔍 Buscar
                </button>
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
              </div>

              <UnidadesInventario 
                unidades={unidades} 
                onAsignarInquilino={(u) => { setModoEdicion(false); setUnidadSeleccionada(u); }} 
                onEditarInquilino={(u) => { setModoEdicion(true); setUnidadSeleccionada(u); }} 
                onVerPagos={onVerPagos} 
                onRefrescar={handleBuscar}
              />
            </>
          )}

          {vista === 'estado-cuenta' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <EstadoCuenta 
                unidades={unidades}
                inquilinosMap={inquilinosMap}
                refrescar={handleBuscar}
              />
            </div>
          )}

          {vista === 'archivo' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ArchivoInquilinos unidades={unidades} />
            </div>
          )}

          {vista === 'mantenimiento-form' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <MantenimientoForm 
                onSuccess={() => {
                  handleBuscar();
                  setVista('mantenimiento-lista');
                }}
              />
            </div>
          )}

          {vista === 'mantenimiento-lista' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <MantenimientoLista />
            </div>
          )}

          {vista === 'servicios-dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ServiciosDashboard />
            </div>
          )}

          {vista === 'reporte-financiero' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ReporteFinancieroGlobal />
            </div>
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
                     handleBuscar();
                   }} 
                   onCancelar={() => setUnidadSeleccionada(null)} 
                />
              </div>
            </div>
          )}
         
        </div>
      </div>
    </div>
  );
};

export default Dashboard;