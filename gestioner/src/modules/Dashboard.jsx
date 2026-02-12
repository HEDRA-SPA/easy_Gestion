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
import RegistroPagoServicios from './components/RegistroPagoServicios';

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
    { id: 'mantenimiento-form', icon: 'fas fa-wrench', label: 'Mantenimiento' },
    { id: 'registro-pago-servicios', icon: 'fas fa-receipt', label: 'Pago Servicios' },
    { id: 'servicios-dashboard', icon: 'fas fa-tint', label: 'Servicios' },
    { id: 'reporte-financiero', icon: 'fas fa-money-bill', label: 'Reporte Fin.' },
    { id: 'gestion-propiedades', icon: 'fas fa-home', label: 'Propiedades' },
  ];

  return (
<div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* OVERLAY MOBILE */}
      {sidebarAbierto && (
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] lg:hidden"
        onClick={() => setSidebarAbierto(false)}
      />
    )}

      {/* SIDEBAR */}
     <div 
      className={`fixed left-0 top-0 h-full bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl transition-all duration-300 z-[70] 
        ${sidebarAbierto ? 'translate-x-0 w-full lg:w-64' : '-translate-x-full lg:translate-x-0 lg:w-16'}
      `}
    >
        {/* HEADER */}
       <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <h1 className={`text-lg font-black text-white tracking-tighter uppercase italic ${!sidebarAbierto && 'lg:hidden'}`}>
          Gestion<span className="text-blue-400">er</span>
        </h1>
        
        {/* Botón Cerrar (X) - Solo visible en móvil cuando está abierto */}
        <button 
          onClick={() => setSidebarAbierto(false)}
          className="lg:hidden p-2 text-white text-2xl"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Botón Chevron - Solo visible en desktop */}
        <button
          onClick={() => setSidebarAbierto(!sidebarAbierto)}
          className="hidden lg:block p-2 rounded-lg hover:bg-slate-700/50 text-white transition-all"
        >
          <i className={`fa-solid ${sidebarAbierto ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
        </button>
      </div>

        {/* MENU ITEMS */}
        <nav className="p-3 space-y-1 overflow-hidden h-auto">
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
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 lg:${sidebarAbierto ? 'ml-64' : 'ml-16'}`}>
       {/* BARRA SUPERIOR MOBILE (TopBar) */}
      <header className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarAbierto(true)}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl"
          >
            <i className="fa-solid fa-bars-staggered text-xl"></i>
          </button>
          <span className="font-black text-slate-800 tracking-tighter uppercase italic text-sm">
            Gestion<span className="text-blue-500">er</span>
          </span>
        </div>
        {/* Indicador de Vista Actual */}
        <div className="bg-slate-100 px-3 py-1 rounded-full">
          <span className="text-[10px] font-black text-slate-500 uppercase">
            {menuItems.find(m => m.id === vista)?.label}
          </span>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {vista === 'operacion' && (
            <>
              {/* FILTROS */}
              <div className="w-full bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
  
  {/* IZQUIERDA: Selector de Modo (Estilo Switch) */}
  <div className="flex items-center gap-3 pl-4">
    <div className="flex flex-col">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Vista</span>
      <div className="flex bg-slate-100/80 p-1 rounded-xl">
        <button 
          onClick={() => setModoFiltro('mes')} 
          className={`px-6 py-2 text-[10px] font-black rounded-lg transition-all ${modoFiltro === 'mes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          MES
        </button>
        <button 
          onClick={() => setModoFiltro('rango')} 
          className={`px-6 py-2 text-[10px] font-black rounded-lg transition-all ${modoFiltro === 'rango' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          RANGO
        </button>
      </div>
    </div>
  </div>

  {/* CENTRO: Inputs de Fecha con estilo minimalista */}
  <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 w-full lg:w-auto">
    <div className="relative group">
      <span className="absolute -top-2 left-3 bg-white px-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter z-10">Inicio</span>
      <div className="flex items-center gap-3 bg-slate-50/50 px-5 py-3 rounded-2xl border border-slate-100 group-hover:border-blue-200 transition-all">
        <i className="fa-regular fa-calendar text-blue-500"></i>
        <input 
          type="date" 
          value={rangoFechas.inicio} 
          onChange={(e) => setRangoFechas({...rangoFechas, inicio: e.target.value})} 
          className="bg-transparent outline-none text-sm font-bold text-slate-700 cursor-pointer"
        />
      </div>
    </div>

    {modoFiltro === 'rango' && (
      <>
        <div className="hidden md:block h-px w-4 bg-slate-200"></div>
        <div className="relative group">
          <span className="absolute -top-2 left-3 bg-white px-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter z-10">Fin</span>
          <div className="flex items-center gap-3 bg-slate-50/50 px-5 py-3 rounded-2xl border border-slate-100 group-hover:border-blue-200 transition-all">
            <i className="fa-regular fa-calendar-check text-blue-500"></i>
            <input 
              type="date" 
              value={rangoFechas.fin} 
              onChange={(e) => setRangoFechas({...rangoFechas, fin: e.target.value})} 
              className="bg-transparent outline-none text-sm font-bold text-slate-700 cursor-pointer"
            />
          </div>
        </div>
      </>
    )}
  </div>

  {/* DERECHA: Botón de Acción */}
  <div className="pr-2 w-full lg:w-auto">
    <button 
      onClick={handleBuscar}
      className="w-full lg:w-auto px-8 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.15em] rounded-2xl hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
    >
      <i className="fa-solid fa-magnifying-glass"></i>
      Actualizar Resultados
    </button>
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
              <br/>
              <MantenimientoLista />
            </div>
          )}
{/*
          {vista === 'mantenimiento-lista' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              
            </div>
          )}
*/}
          {vista === 'registro-pago-servicios' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <RegistroPagoServicios />
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

          {vista === 'gestion-propiedades' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <GestionPropiedades />
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
      </main>
    </div>
  </div>
);
};

export default Dashboard;