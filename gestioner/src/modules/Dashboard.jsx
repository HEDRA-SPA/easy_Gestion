import React, { useState } from 'react';
import StatCard from './components/StatCard';
import AdeudosTable from './components/AdeudosTable';
import UnidadesInventario from './components/UnidadesInventario';
import FormularioNuevoInquilino from './components/FormularioNuevoInquilino';

const Dashboard = ({ resumen, adeudos, unidades, refrescarDatos, onVerPagos }) => {
  // 1. Estados para el Modal
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);

  // 2. Manejadores de cierre y éxito
  const handleCerrarModal = () => {
    setUnidadSeleccionada(null);
    setModoEdicion(false);
  };

  const handleExito = () => {
    handleCerrarModal();
    refrescarDatos(); // Recarga los datos de Firebase para ver los cambios
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans relative">
      
      {/* CAPA DE FORMULARIO (Modal) */}
      {unidadSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-4xl">
            <FormularioNuevoInquilino 
              unidad={unidadSeleccionada} 
              esEdicion={modoEdicion} // <--- Le avisa al formulario si debe actualizar o crear
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
        // Acción para unidades vacías
        onAsignarInquilino={(u) => {
          setModoEdicion(false);
          setUnidadSeleccionada(u);
        }} 
        // Acción para el icono del lápiz (Unidades ocupadas)
        onEditarInquilino={(u) => {
          setModoEdicion(true);
          setUnidadSeleccionada(u);
        }}
        onVerPagos={onVerPagos}
        onRefrescar={refrescarDatos} 
      />

    </div>
  );
};

export default Dashboard;