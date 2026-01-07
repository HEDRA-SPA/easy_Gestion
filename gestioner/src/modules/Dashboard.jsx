import React, { useState } from 'react';
import StatCard from './components/StatCard';
import AdeudosTable from './components/AdeudosTable';
import UnidadesInventario from './components/UnidadesInventario';
import FormularioNuevoInquilino from './components/FormularioNuevoInquilino';

const Dashboard = ({ resumen, adeudos, unidades, refrescarDatos }) => {
  // Estado para controlar qué unidad se está editando
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);

const handleExito = () => {
    setUnidadSeleccionada(null); // Cierra el modal
    refrescarDatos(); // <--- Aquí es donde ocurre la "magia" de la actualización
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans relative">
      
      {/* CAPA DE FORMULARIO (Solo aparece si hay una unidad seleccionada) */}
      {unidadSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-4xl">
           <FormularioNuevoInquilino 
       unidad={unidadSeleccionada} 
       onExito={handleExito} // <--- Al terminar, dispara el refresco
       onCancelar={() => setUnidadSeleccionada(null)}
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

      {/* BLOQUE 3: DISPONIBILIDAD 
          Pasamos la función para "seleccionar" la unidad al inventario */}
    <UnidadesInventario 
  unidades={unidades} 
  onAsignarInquilino={(u) => setUnidadSeleccionada(u)} 
  onRefrescar={refrescarDatos} // <--- ¡AQUÍ ESTABA EL FALTANTE!
/>

    </div>
  );
};

export default Dashboard;