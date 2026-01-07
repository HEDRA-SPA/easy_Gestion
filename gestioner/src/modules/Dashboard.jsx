// src/modules/Dashboard/Dashboard.jsx
import React from 'react';
import StatCard from './components/StatCard';
import AdeudosTable from './components/AdeudosTable';
import UnidadesInventario from './components/UnidadesInventario';

const Dashboard = ({ resumen, adeudos, unidades }) => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans">
      {/* BLOQUE 1: RESUMEN FINANCIERO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Ingreso Esperado" value={resumen.esperado} color="blue" />
        <StatCard title="Cobrado (Enero)" value={resumen.pagado} color="green" />
        <StatCard title="Pendiente / Adeudo" value={resumen.adeudo} color="red" />
      </div>
      {/* BLOQUE 2: TABLA DE ADEUDOS */}
      <AdeudosTable adeudos={adeudos} />
      {/* BLOQUE 3: DISPONIBILIDAD */}
      <UnidadesInventario unidades={unidades} />

    </div>
  );
};

export default Dashboard;