import React, { useState, useEffect } from 'react';
import { 
  obtenerDatosSeguimientoPeriodo, 
  crearSeguimientoPeriodo, 
  marcarSeguimientoPagado,
  obtenerSeguimientos 
} from '../../firebase/acciones';

const RegistroPagoServicios = () => {
  const [periodSeleccionado, setPeriodSeleccionado] = useState('');
  const [loading, setLoading] = useState(false);
  const [datosActuales, setDatosActuales] = useState(null);
  const [seguimientos, setSeguimientos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [vista, setVista] = useState('nuevo'); // 'nuevo' o 'historial'

  // Inicializar con periodo actual
  useEffect(() => {
    const hoy = new Date();
    const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    setPeriodSeleccionado(periodoActual);
    cargarSeguimientos();
  }, []);

  const cargarSeguimientos = async (estado = null) => {
    setLoading(true);
    try {
      const resultado = await obtenerSeguimientos(estado);
      if (resultado.exito) {
        setSeguimientos(resultado.datos);
        setFiltroEstado(estado);
      }
    } catch (error) {
      console.error('Error cargando seguimientos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleObtenerDatos = async () => {
    if (!periodSeleccionado) {
      alert('Por favor selecciona un período');
      return;
    }

    setLoading(true);
    try {
      const resultado = await obtenerDatosSeguimientoPeriodo(periodSeleccionado);
      
      if (resultado.exito) {
        setDatosActuales(resultado);
      } else {
        alert('Error al obtener datos: ' + resultado.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al obtener datos del período');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarPago = async () => {
    if (!datosActuales) return;

    setLoading(true);
    try {
      const resultado = await crearSeguimientoPeriodo(periodSeleccionado, datosActuales);
      
      if (resultado.exito) {
        alert('✅ ' + resultado.mensaje);
        setDatosActuales(null);
        cargarSeguimientos();
        setVista('historial');
      } else {
        alert('❌ Error: ' + resultado.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarPagado = async (periodo) => {
    setLoading(true);
    try {
      const resultado = await marcarSeguimientoPagado(periodo);
      
      if (resultado.exito) {
        alert('✅ ' + resultado.mensaje);
        cargarSeguimientos(filtroEstado);
      } else {
        alert('❌ Error: ' + resultado.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al marcar como pagado');
    } finally {
      setLoading(false);
    }
  };

  const formatearPeriodo = (periodo) => {
    const [anio, mes] = periodo.split('-');
    const fecha = new Date(anio, mes - 1, 1);
    return fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
  };

  return (
    <>
      {/* ENCABEZADO */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl"><i className="fa-solid fa-receipt"></i></span>
              Registrar Pago de Servicios
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Contabiliza servicios condonados y mantenimientos realizados en el período.
            </p>
          </div>
        </div>
      </div>

      {/* Selector de Vista */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setVista('nuevo')}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${
            vista === 'nuevo'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <i className="fa-solid fa-plus mr-2"></i> Crear Ticket
        </button>
        <button
          onClick={() => setVista('historial')}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${
            vista === 'historial'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <i className="fa-solid fa-history mr-2"></i> Historial
        </button>
      </div>

      {/* VISTA: NUEVO REGISTRO */}
      {vista === 'nuevo' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          {/* Selector de Periodo */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Selecciona el Período *
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="month"
                value={periodSeleccionado}
                onChange={(e) => setPeriodSeleccionado(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleObtenerDatos}
                disabled={loading || !periodSeleccionado}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-search"></i>
                {loading ? 'Cargando...' : 'Consultar'}
              </button>
            </div>
          </div>

          {/* RESULTADOS */}
          {datosActuales && !loading && (
            <div className="space-y-6">
              {/* Cards Resumen */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card Servicios */}
                <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-5 text-white shadow-lg">
                  <p className="text-cyan-100 text-xs font-bold uppercase mb-2">
                    <i className="fa-solid fa-droplet mr-1"></i> Servicios Condonados
                  </p>
                  <p className="text-3xl font-bold">
                    ${datosActuales.servicios.total.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                  </p>
                  <div className="text-xs text-cyan-100 mt-2 space-y-1">
                    <p>💧 Agua: ${datosActuales.servicios.agua.toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    <p>⚡ Luz: ${datosActuales.servicios.luz.toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                  </div>
                </div>

                {/* Card Mantenimientos */}
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-lg">
                  <p className="text-orange-100 text-xs font-bold uppercase mb-2">
                    <i className="fa-solid fa-wrench mr-1"></i> Mantenimientos
                  </p>
                  <p className="text-3xl font-bold">
                    ${datosActuales.mantenimientos.total.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                  </p>
                  <p className="text-xs text-orange-100 mt-2">
                    {datosActuales.mantenimientos.cantidad} registro(s)
                  </p>
                </div>

                {/* Card Total */}
                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white shadow-lg">
                  <p className="text-red-100 text-xs font-bold uppercase mb-2">
                    <i className="fa-solid fa-calculator mr-1"></i> Total Egresos
                  </p>
                  <p className="text-3xl font-bold">
                    ${datosActuales.total_egresos.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                  </p>
                  <p className="text-xs text-red-100 mt-2">
                    {datosActuales.cantidad_unidades_afectadas} unidad(es) afectada(s)
                  </p>
                </div>
              </div>

              {/* Detalle de Servicios */}
              {datosActuales.servicios.detalle.length > 0 && (
                <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-droplet text-cyan-600"></i>
                    Detalle de Servicios Condonados
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-cyan-200">
                          <th className="text-left py-2 px-3 font-bold text-gray-700">Unidad</th>
                          <th className="text-right py-2 px-3 font-bold text-gray-700">Agua</th>
                          <th className="text-right py-2 px-3 font-bold text-gray-700">Luz</th>
                          <th className="text-right py-2 px-3 font-bold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datosActuales.servicios.detalle.map((detalle, idx) => (
                          <tr key={idx} className="border-b border-cyan-100 hover:bg-white">
                            <td className="py-2 px-3 font-medium">{detalle.id_unidad}</td>
                            <td className="text-right py-2 px-3">
                              ${detalle.agua.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                            </td>
                            <td className="text-right py-2 px-3">
                              ${detalle.luz.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                            </td>
                            <td className="text-right py-2 px-3 font-bold">
                              ${detalle.total.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detalle de Mantenimientos */}
              {datosActuales.mantenimientos.detalle.length > 0 && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-wrench text-orange-600"></i>
                    Mantenimientos Realizados
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-orange-200">
                          <th className="text-left py-2 px-3 font-bold text-gray-700">Unidad</th>
                          <th className="text-left py-2 px-3 font-bold text-gray-700">Concepto</th>
                          <th className="text-left py-2 px-3 font-bold text-gray-700">Categoría</th>
                          <th className="text-right py-2 px-3 font-bold text-gray-700">Costo</th>
                          <th className="text-center py-2 px-3 font-bold text-gray-700">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datosActuales.mantenimientos.detalle.map((detalle, idx) => (
                          <tr key={idx} className="border-b border-orange-100 hover:bg-white">
                            <td className="py-2 px-3 font-medium">{detalle.id_unidad}</td>
                            <td className="py-2 px-3">{detalle.concepto}</td>
                            <td className="py-2 px-3">
                              <span className="inline-block bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">
                                {detalle.categoria}
                              </span>
                            </td>
                            <td className="text-right py-2 px-3 font-bold">
                              ${detalle.costo.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                            </td>
                            <td className="text-center py-2 px-3">
                              <span className={`inline-block text-xs font-bold px-2 py-1 rounded ${
                                detalle.estatus === 'completado' ? 'bg-green-100 text-green-700' :
                                detalle.estatus === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {detalle.estatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Botón Registrar */}
              <div className="flex gap-3">
                <button
                  onClick={handleRegistrarPago}
                  disabled={loading}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-check"></i>
                  {loading ? 'Registrando...' : 'Registrar Pago de Servicios'}
                </button>
                <button
                  onClick={() => setDatosActuales(null)}
                  className="px-6 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {loading && !datosActuales && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-4">Cargando datos del período...</p>
            </div>
          )}

          {!datosActuales && !loading && periodSeleccionado && (
            <div className="text-center py-12 text-gray-500">
              <i className="fa-solid fa-inbox text-4xl mb-3 block opacity-50"></i>
              <p>Consulta un período para ver los datos</p>
            </div>
          )}
        </div>
      )}

      {/* VISTA: HISTORIAL */}
      {vista === 'historial' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              onClick={() => cargarSeguimientos(null)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                filtroEstado === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Lista de Seguimientos */}
          <div className="space-y-4">
            {seguimientos.length > 0 ? (
              seguimientos.map((seg) => (
                <div
                  key={seg.id}
                  className={`border-2 rounded-xl p-4 transition-all ${
                    seg.estado_pago === 'pagado'
                      ? 'border-green-200 bg-green-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Información */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-800">
                          {formatearPeriodo(seg.periodo)}
                        </h3>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          seg.estado_pago === 'pagado'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-yellow-200 text-yellow-800'
                        }`}>
                          {seg.estado_pago === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs font-bold">Servicios</p>
                          <p className="text-lg font-bold text-cyan-600">
                            ${seg.servicios_total.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs font-bold">Mantenimientos</p>
                          <p className="text-lg font-bold text-orange-600">
                            ${seg.mantenimientos_total.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs font-bold">Total</p>
                          <p className="text-lg font-bold text-red-600">
                            ${seg.total_egresos.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                          </p>
                        </div>
                      </div>

                      {seg.fecha_pago && (
                        <p className="text-xs text-gray-600 mt-2">
                          <i className="fa-solid fa-calendar-check mr-1"></i>
                          Pagado: {new Date(seg.fecha_pago.seconds * 1000).toLocaleDateString('es-MX')}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2">
                      {seg.estado_pago === 'pendiente' && (
                        <button
                          onClick={() => handleMarcarPagado(seg.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          <i className="fa-solid fa-check"></i>
                          Marcar Pagado
                        </button>
                      )}
                      <button
                        onClick={() => {
                          // Expandir detalles o ver más info
                          alert(`Detalles de ${seg.periodo}:\n\nServicios: $${seg.servicios_total}\nMantenimientos: $${seg.mantenimientos_total}\nTotal: $${seg.total_egresos}`);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-eye"></i>
                        Ver
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <i className="fa-solid fa-inbox text-4xl mb-3 block opacity-50"></i>
                <p>No hay seguimientos registrados</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default RegistroPagoServicios;
