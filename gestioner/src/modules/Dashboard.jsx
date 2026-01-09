import React, { useState } from 'react';
import StatCard from './components/StatCard';
import AdeudosTable from './components/AdeudosTable';
import UnidadesInventario from './components/UnidadesInventario';
import FormularioNuevoInquilino from './components/FormularioNuevoInquilino';
import ArchivoInquilinos from './ArchivoInquilinos'; // <--- Importamos el componente

const Dashboard = ({ resumen, adeudos, unidades, refrescarDatos, onVerPagos }) => {
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [vista, setVista] = useState('operacion');
  const [periodoConsulta, setPeriodoConsulta] = useState(new Date().toISOString().split('T')[0].slice(0, 7));

  const handleCerrarModal = () => {
    setUnidadSeleccionada(null);
    setModoEdicion(false);
  };

  const handleExito = () => {
    handleCerrarModal();
    refrescarDatos();
  };
const handleCambioPeriodo = (e) => {
  const nuevaFecha = e.target.value; // "2026-01-15"
  const nuevoPeriodo = nuevaFecha.slice(0, 7); // "2026-01"
  
  setPeriodoConsulta(nuevoPeriodo);
  // ¡CLAVE! Pasamos el nuevo periodo directamente a la función que viene de App.js
  refrescarDatos(nuevoPeriodo); 
};
  const handleCambioFechaCompleta = (e) => {
  const fechaSeleccionada = e.target.value; // Recibe "YYYY-MM-DD"
  if (!fechaSeleccionada) return;

  // Cortamos el string para obtener solo "YYYY-MM"
  const nuevoPeriodo = fechaSeleccionada.slice(0, 7); 
  
  setPeriodoConsulta(nuevoPeriodo);
  refrescarDatos(nuevoPeriodo); // Envía solo el mes y año a Firebase
};
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans relative">
      
      {/* NAVEGACIÓN DE VISTAS */}
      <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setVista('operacion')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${vista === 'operacion' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
        >
          📊 Operación Actual
        </button>
        <button 
          onClick={() => setVista('archivo')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${vista === 'archivo' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
        >
          📁 Archivo Histórico
        </button>
      </div>
{vista === 'operacion' && (
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-400 uppercase leading-none">Periodo de consulta</span>
              <input 
          type="date" 
          // Para que el input muestre la fecha, necesita el formato YYYY-MM-DD
          // Le agregamos "-01" para que siempre apunte al día primero visualmente
          value={`${periodoConsulta}-01`}
          onChange={handleCambioFechaCompleta}
          className="text-sm font-bold text-gray-700 outline-none cursor-pointer border-none bg-transparent focus:ring-0"
        />
            </div>
            <div className="h-8 w-[1px] bg-gray-100 mx-1"></div>
            <span className="text-xl">🗓️</span>
          </div>
        )}
      {/* RENDERIZADO CONDICIONAL */}
      {vista === 'operacion' ? (
        <>
          {/* CAPA DE FORMULARIO (Modal) */}
          {unidadSeleccionada && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <div className="w-full max-w-4xl">
                <FormularioNuevoInquilino 
                  unidad={unidadSeleccionada} 
                  esEdicion={modoEdicion} 
                  onExito={handleExito} 
                  onCancelar={handleCerrarModal}
                />
              </div>
              
          </div>
          )}
          {/* SELECTOR DE PERIODO (Solo visible en Operación) */}
        
      
          {/* BLOQUE 1: RESUMEN FINANCIERO */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Ingreso Esperado" value={resumen.esperado} color="blue" />
            <StatCard title="Cobrado" value={resumen.pagado} color="green" />
            <StatCard title="Pendiente" value={resumen.adeudo} color="red" />
          </div>

          {/* BLOQUE 2: TABLA DE ADEUDOS */}
         <AdeudosTable adeudos={adeudos} periodo={periodoConsulta} />

          {/* BLOQUE 3: CONTROL DE INVENTARIO */}
          <UnidadesInventario 
            unidades={unidades} 
            onAsignarInquilino={(u) => {
              setModoEdicion(false);
              setUnidadSeleccionada(u);
            }} 
            onEditarInquilino={(u) => {
              setModoEdicion(true);
              setUnidadSeleccionada(u);
            }}
            onVerPagos={onVerPagos}
            onRefrescar={refrescarDatos} 
          />
        </>
      ) : (
        /* VISTA DE ARCHIVO HISTÓRICO */
        <div className="animate-in fade-in duration-500">
           <ArchivoInquilinos />
        </div>
      )}
    </div>
  );
};

export default Dashboard;