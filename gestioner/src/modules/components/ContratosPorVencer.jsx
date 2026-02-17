import React, { useState, useEffect } from 'react';
import { obtenerContratosPorVencer, obtenerContratosVencidos } from '../../firebase/acciones';

export default function ContratosPorVencer({ onIrAArchivo }) {
  const [contratosPorVencer, setContratosPorVencer] = useState([]);
  const [contratosVencidos, setContratosVencidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diasFiltro, setDiasFiltro] = useState(30);

  // Función para cargar datos Cuando se monta el componente o cambia el filtro
  useEffect(() => {
    cargarContratos();
  }, [diasFiltro]);

  const cargarContratos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener contratos próximos a vencer
      const respuestaPorVencer = await obtenerContratosPorVencer(diasFiltro);
      if (respuestaPorVencer.exito) {
        setContratosPorVencer(respuestaPorVencer.datos);
      } else {
        setError('Error al cargar contratos por vencer');
      }

      // Obtener contratos vencidos
      const respuestaVencidos = await obtenerContratosVencidos();
      if (respuestaVencidos.exito) {
        setContratosVencidos(respuestaVencidos.datos);
      }
    } catch (err) {
      console.error('Error cargando contratos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '';
    const date = fecha instanceof Date ? fecha : new Date(fecha);
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const formatearDinero = (cantidad) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(cantidad);
  };

  const getUrgencyColor = (diasRestantes) => {
    if (diasRestantes <= 7) return 'bg-red-50 border-red-200';
    if (diasRestantes <= 15) return 'bg-yellow-50 border-yellow-200';
    return 'bg-orange-50 border-orange-200';
  };

  const getUrgencyBadge = (diasRestantes) => {
    if (diasRestantes <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
          🔴 URGENTE
        </span>
      );
    }
    if (diasRestantes <= 15) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
          🟡 PRÓXIMO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
        🟠 AVISO
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Cargando contratos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-8 flex items-start gap-4">
        <h1 className="text-[22px] font-bold text-[#1e293b] leading-tight"> Contratos Próximos a Vencer</h1>
        <p className="text-[#64748b] text-[15px] mt-1 font-medium">Monitorea los contratos que están por expirar para gestionar renovaciones a tiempo</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold"> Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Filtro de días */}
      <div className="flex gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          Mostrar contratos próximos a vencer en:
        </label>
        <div className="flex gap-2">
          {[7, 15, 30, 60].map((dias) => (
            <button
              key={dias}
              onClick={() => setDiasFiltro(dias)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                diasFiltro === dias
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {dias} días
            </button>
          ))}
        </div>
      </div>

      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">
            {contratosPorVencer.filter((c) => c.diasRestantes <= 7).length}
          </div>
          <p className="text-sm text-red-700 font-medium">Urgentes (0-7 días)</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {contratosPorVencer.filter((c) => c.diasRestantes > 7 && c.diasRestantes <= 15).length}
          </div>
          <p className="text-sm text-yellow-700 font-medium">Próximos (8-15 días)</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">
            {contratosVencidos.length}
          </div>
          <p className="text-sm text-blue-700 font-medium">Vencidos</p>
        </div>
      </div>

      {/* Contratos próximos a vencer */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
           Próximos a Vencer ({contratosPorVencer.length})
        </h2>

        {contratosPorVencer.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <p className="text-green-800 font-medium">No hay contratos próximos a vencer en los próximos {diasFiltro} días</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {contratosPorVencer.map((contrato) => (
              <div
                key={contrato.id}
                className={`border-2 rounded-lg p-5 transition-all hover:shadow-lg ${getUrgencyColor(contrato.diasRestantes)}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{contrato.nombre_inquilino}</h3>
                    <p className="text-sm text-gray-600">Unidad: {contrato.id_unidad}</p>
                  </div>
                  {getUrgencyBadge(contrato.diasRestantes)}
                </div>

                <div className="space-y-2 mb-4 pb-4 border-b border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Renta Mensual:</span>
                    <span className="font-semibold text-gray-800">{formatearDinero(contrato.monto_renta)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fecha de Vencimiento:</span>
                    <span className="font-semibold text-gray-800">{formatearFecha(contrato.fecha_fin)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">{contrato.diasRestantes}</p>
                    <p className="text-xs text-gray-600">días restantes</p>
                  </div>
                  <button
                    onClick={() => {
                      if (onIrAArchivo) {
                        onIrAArchivo();
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
                  >
                    <i className="fa-solid fa-folder-open"></i>
                    Renovar
                  </button>
                </div>

                {contrato.dia_pago && (
                  <p className="text-xs text-gray-500 mt-3">💳 Día de pago: {contrato.dia_pago}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contratos vencidos */}
      {contratosVencidos.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
            ❌ Contratos Vencidos ({contratosVencidos.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {contratosVencidos.map((contrato) => (
              <div
                key={contrato.id}
                className="border-2 border-red-300 bg-red-50 rounded-lg p-5 transition-all hover:shadow-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{contrato.nombre_inquilino}</h3>
                    <p className="text-sm text-gray-600">Unidad: {contrato.id_unidad}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                    ❌ VENCIDO
                  </span>
                </div>

                <div className="space-y-2 mb-4 pb-4 border-b border-red-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Renta Mensual:</span>
                    <span className="font-semibold text-gray-800">{formatearDinero(contrato.monto_renta)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fecha de Vencimiento:</span>
                    <span className="font-semibold text-red-600">{formatearFecha(contrato.fecha_fin)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-red-600">+{contrato.diasVencidos}</p>
                    <p className="text-xs text-gray-600">días vencido</p>
                  </div>
                  <button
                    onClick={() => {
                      if (onIrAArchivo) {
                        onIrAArchivo();
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors text-sm flex items-center gap-2"
                  >
                    <i className="fa-solid fa-folder-open"></i>
                    Resolver
                  </button>
                </div>

                {contrato.dia_pago && (
                  <p className="text-xs text-gray-500 mt-3">💳 Día de pago: {contrato.dia_pago}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}