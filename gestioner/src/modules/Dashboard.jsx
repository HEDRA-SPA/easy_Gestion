import React, { useState } from 'react';
import StatCard from './components/StatCard';
import AdeudosTable from './components/AdeudosTable';
import UnidadesInventario from './components/UnidadesInventario';
import FormularioNuevoInquilino from './components/FormularioNuevoInquilino';
import ArchivoInquilinos from './ArchivoInquilinos'; // <--- Importamos el componente

const Dashboard = ({ resumen, adeudos, unidades, refrescarDatos, onVerPagos }) => {
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  // 'operacion' = Dashboard normal / 'archivo' = Ex-inquilinos
  const [vista, setVista] = useState('operacion');

  const handleCerrarModal = () => {
    setUnidadSeleccionada(null);
    setModoEdicion(false);
  };

  const handleExito = () => {
    handleCerrarModal();
    refrescarDatos();
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

          {/* BLOQUE 1: RESUMEN FINANCIERO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Ingreso Esperado" value={resumen.esperado} color="blue" />
            <StatCard title="Cobrado (Periodo)" value={resumen.pagado} color="green" />
            <StatCard title="Pendiente / Adeudo" value={resumen.adeudo} color="red" />
          </div>

          {/* BLOQUE 2: TABLA DE ADEUDOS */}
          <AdeudosTable adeudos={adeudos} />

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