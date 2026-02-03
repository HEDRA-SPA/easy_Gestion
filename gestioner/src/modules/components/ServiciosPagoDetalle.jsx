import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ServiciosPagoDetalle = () => {
  const [periodo, setPeriodo] = useState('');
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroUnidad, setFiltroUnidad] = useState('');
  const [mostrarSoloConServicios, setMostrarSoloConServicios] = useState(true);

  useEffect(() => {
    const hoy = new Date();
    const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    setPeriodo(periodoActual);
  }, []);

  const cargarPagos = async () => {
    if (!periodo) return;
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'pagos'),
        where('periodo', '==', periodo),
        orderBy('id_unidad', 'asc')
      );

      const snapshot = await getDocs(q);
      const pagosData = [];

      for (const docSnap of snapshot.docs) {
        const pagoData = { id: docSnap.id, ...docSnap.data() };
        
        // Obtener info del inquilino si existe
        if (pagoData.id_inquilino) {
          try {
            const inquilinoRef = doc(db, 'inquilinos', pagoData.id_inquilino);
            const inquilinoSnap = await getDoc(inquilinoRef);
            if (inquilinoSnap.exists()) {
              pagoData.inquilino_info = inquilinoSnap.data();
            }
          } catch (error) {
            console.error('Error al cargar inquilino:', error);
          }
        }

        // Filtrar por unidad si se especificó
        if (!filtroUnidad || pagoData.id_unidad.toLowerCase().includes(filtroUnidad.toLowerCase())) {
          // Filtrar por servicios si está activado
          if (!mostrarSoloConServicios || 
              (pagoData.servicios && 
               (pagoData.servicios.agua_lectura > 0 || pagoData.servicios.luz_lectura > 0))) {
            pagosData.push(pagoData);
          }
        }
      }

      setPagos(pagosData);
    } catch (error) {
      console.error('Error al cargar pagos:', error);
      alert('Error al cargar pagos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A';
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha.toDate();
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calcularExcedente = (lectura, limite) => {
    return Math.max(0, lectura - limite);
  };

  return (
    <>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6 mt-6">
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
         <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl"><i class="fa-solid fa-droplet"></i></span>
              Detalle de pago de servicios
            </h1>
       <p className="text-sm sm:text-base text-gray-500 mt-1">
          Detalles de pago de servicios de unidades especificas
        </p>
      </div>
      </div>
</div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        {/* Header */}
   

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Periodo
            </label>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Unidad
            </label>
            <input
              type="text"
              value={filtroUnidad}
              onChange={(e) => setFiltroUnidad(e.target.value)}
              placeholder="Ej: CH-8"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarSoloConServicios}
                onChange={(e) => setMostrarSoloConServicios(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Solo con servicios registrados</span>
            </label>
          </div>
        </div>

        <button
          onClick={cargarPagos}
          disabled={loading || !periodo}
           className="w-full flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-xl transition-all shadow-sm text-sm sm:text-base"
        >
          {loading ? 'Cargando...' : 'Buscar Pagos'}
        </button>
      </div>

      {/* Resultados */}
      {pagos.length > 0 ? (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-blue-800 font-medium">
              Se encontraron {pagos.length} pagos en el periodo {periodo}
            </p>
          </div>

          {pagos.map((pago) => {
            const servicios = pago.servicios || {};
            const aguaExcedente = calcularExcedente(
              servicios.agua_lectura || 0,
              servicios.limite_agua_aplicado || 250
            );
            const luzExcedente = calcularExcedente(
              servicios.luz_lectura || 0,
              servicios.limite_luz_aplicado || 250
            );
            const totalExcedente = aguaExcedente + luzExcedente;

            return (
              <div key={pago.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Header de la tarjeta */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold mb-1">Unidad {pago.id_unidad}</h3>
                      {pago.inquilino_info && (
                        <p className="text-blue-100">{pago.inquilino_info.nombre_completo}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-blue-100">Periodo</p>
                      <p className="text-lg font-semibold">{pago.periodo}</p>
                    </div>
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Información del Pago */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Información del Pago
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Monto pagado:</span>
                          <span className="font-semibold">${pago.monto_pagado.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total esperado:</span>
                          <span className="font-semibold">${pago.total_esperado_periodo.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Medio de pago:</span>
                          <span className="font-semibold capitalize">{pago.medio_pago}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Estatus:</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            pago.estatus === 'pagado' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {pago.estatus}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fecha de pago:</span>
                          <span className="font-semibold">{formatearFecha(pago.fecha_pago_realizado)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Servicios - Agua */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                        </svg>
                        Agua
                      </h4>
                      <div className="space-y-3">
                        <div className="bg-cyan-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Lectura</p>
                          <p className="text-2xl font-bold text-cyan-700">
                            ${servicios.agua_lectura || 0}
                          </p>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Límite aplicado:</span>
                            <span className="font-semibold">${servicios.limite_agua_aplicado || 250}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Condonado:</span>
                            <span className="font-semibold text-green-600">
                              ${Math.min(servicios.agua_lectura || 0, servicios.limite_agua_aplicado || 250)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Excedente:</span>
                            <span className={`font-semibold ${aguaExcedente > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              ${aguaExcedente}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Servicios - Luz */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Luz
                      </h4>
                      <div className="space-y-3">
                        <div className="bg-yellow-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Lectura</p>
                          <p className="text-2xl font-bold text-yellow-700">
                            ${servicios.luz_lectura || 0}
                          </p>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Límite aplicado:</span>
                            <span className="font-semibold">${servicios.limite_luz_aplicado || 250}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Condonado:</span>
                            <span className="font-semibold text-green-600">
                              ${Math.min(servicios.luz_lectura || 0, servicios.limite_luz_aplicado || 250)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Excedente:</span>
                            <span className={`font-semibold ${luzExcedente > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              ${luzExcedente}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumen de Excedentes */}
                  {totalExcedente > 0 && (
                    <div className="mt-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-800">Total de Excedentes</p>
                          <p className="text-2xl font-bold text-red-600">${totalExcedente}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-red-700">Cobrado de:</p>
                          <p className="text-lg font-semibold text-red-800 capitalize">
                            {servicios.excedentes_cobrados_de || 'N/A'}
                          </p>
                          {servicios.excedentes_del_deposito > 0 && (
                            <p className="text-sm text-red-600 mt-1">
                              Monto: ${servicios.excedentes_del_deposito}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {totalExcedente === 0 && (servicios.agua_lectura > 0 || servicios.luz_lectura > 0) && (
                    <div className="mt-6 bg-green-50 border-l-4 border-green-400 p-4 rounded">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm font-medium text-green-800">
                          Sin excedentes - El consumo está dentro del límite condonado
                        </p>
                      </div>
                    </div>
                  )}

                  {!servicios.agua_lectura && !servicios.luz_lectura && (
                    <div className="mt-6 bg-gray-50 border-l-4 border-gray-300 p-4 rounded">
                      <p className="text-sm text-gray-600">
                        No hay servicios registrados en este pago
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Cargando pagos...</p>
        </div>
      ) : periodo ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                No se encontraron pagos{mostrarSoloConServicios ? ' con servicios registrados' : ''} 
                {filtroUnidad && ` para la unidad "${filtroUnidad}"`} en el periodo seleccionado.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
};

export default ServiciosPagoDetalle;