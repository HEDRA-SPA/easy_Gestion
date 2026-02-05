import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const ServiciosDashboard = () => {
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [propiedadFiltro, setPropiedadFiltro] = useState('');
  const [loading, setLoading] = useState(false);
  const [datos, setDatos] = useState(null);
  const [pagosDetalle, setPagosDetalle] = useState([]);

  useEffect(() => {
    // Establecer el periodo actual por defecto
    const hoy = new Date();
    const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    setPeriodoInicio(periodoActual);
    setPeriodoFin(periodoActual);
  }, []);

  const analizarServicios = async () => {
    if (!periodoInicio) {
      alert('Por favor selecciona al menos un periodo de inicio');
      return;
    }

    setLoading(true);
    try {
      // 🔥 CAMBIO: Obtener TODOS los pagos sin filtro de Firestore
      console.log('Obteniendo todos los pagos...');
      const pagosSnapshot = await getDocs(collection(db, 'pagos'));
      const pagosData = [];
      
      pagosSnapshot.forEach((doc) => {
        pagosData.push({ id: doc.id, ...doc.data() });
      });

      console.log(`Total de pagos en BD: ${pagosData.length}`);

      // 🔥 CAMBIO: Filtrar por periodo EN MEMORIA
      let pagosFiltrados = pagosData;
      
      if (periodoInicio && periodoFin) {
        console.log(`Filtrando por rango: ${periodoInicio} a ${periodoFin}`);
        pagosFiltrados = pagosData.filter(pago => {
          if (!pago.periodo) return false;
          return pago.periodo >= periodoInicio && pago.periodo <= periodoFin;
        });
      } else if (periodoInicio) {
        console.log(`Filtrando por periodo único: ${periodoInicio}`);
        pagosFiltrados = pagosData.filter(pago => pago.periodo === periodoInicio);
      }

      console.log(`Pagos después de filtrar por periodo: ${pagosFiltrados.length}`);

      // Filtrar por propiedad si se especificó
      if (propiedadFiltro) {
        console.log(`Filtrando por propiedad: ${propiedadFiltro}`);
        pagosFiltrados = pagosFiltrados.filter(pago => 
          pago.id_unidad && pago.id_unidad.startsWith(propiedadFiltro)
        );
        console.log(`Pagos después de filtrar por propiedad: ${pagosFiltrados.length}`);
      }

      // Ya no filtramos por inquilinos activos - queremos ver TODOS los pagos del periodo
      const pagosActivos = pagosFiltrados;

      console.log(`Pagos a analizar: ${pagosActivos.length}`);

      // Analizar servicios
      const analisis = {
        total_pagos_analizados: pagosActivos.length,
        total_agua_consumida: 0,
        total_luz_consumida: 0,
        total_agua_condonada: 0,
        total_luz_condonada: 0,
        unidades_con_servicios: 0,
        unidades_excedieron_agua: 0,
        unidades_excedieron_luz: 0,
        excedentes_cobrados_deposito: 0,
        excedentes_cobrados_renta: 0,
        total_excedentes_agua: 0,
        total_excedentes_luz: 0,
        por_unidad: {},
        por_propiedad: {}
      };

      pagosActivos.forEach(pago => {
        if (pago.servicios) {
          const { 
            agua_lectura = 0, 
            luz_lectura = 0,
            limite_agua_aplicado = 250,
            limite_luz_aplicado = 250,
            excedentes_cobrados_de = 'deposito',
            excedentes_del_deposito = 0
          } = pago.servicios;

          // Solo contar si hay consumo real (>0)
          if (agua_lectura > 0 || luz_lectura > 0) {
            console.log(`✅ Unidad ${pago.id_unidad} (${pago.periodo}): Agua=${agua_lectura}, Luz=${luz_lectura}`);
            analisis.unidades_con_servicios++;

            // Sumar consumos totales
            analisis.total_agua_consumida += agua_lectura;
            analisis.total_luz_consumida += luz_lectura;

            // Calcular lo que se condonó (usó del límite)
            const agua_condonada = Math.min(agua_lectura, limite_agua_aplicado);
            const luz_condonada = Math.min(luz_lectura, limite_luz_aplicado);
            
            analisis.total_agua_condonada += agua_condonada;
            analisis.total_luz_condonada += luz_condonada;

            // Calcular excedentes
            const excedente_agua = Math.max(0, agua_lectura - limite_agua_aplicado);
            const excedente_luz = Math.max(0, luz_lectura - limite_luz_aplicado);
            
            if (excedente_agua > 0) analisis.unidades_excedieron_agua++;
            if (excedente_luz > 0) analisis.unidades_excedieron_luz++;

            analisis.total_excedentes_agua += excedente_agua;
            analisis.total_excedentes_luz += excedente_luz;

            // Contar de dónde se cobraron excedentes
            if (excedentes_cobrados_de === 'deposito') {
              analisis.excedentes_cobrados_deposito += excedentes_del_deposito;
            } else {
              const total_excedente = excedente_agua + excedente_luz;
              analisis.excedentes_cobrados_renta += total_excedente;
            }

            // Agrupar por unidad
            if (!analisis.por_unidad[pago.id_unidad]) {
              analisis.por_unidad[pago.id_unidad] = {
                unidad: pago.id_unidad,
                agua_total: 0,
                luz_total: 0,
                agua_condonada: 0,
                luz_condonada: 0,
                excedente_agua: 0,
                excedente_luz: 0,
                pagos_con_servicios: 0
              };
            }

            analisis.por_unidad[pago.id_unidad].agua_total += agua_lectura;
            analisis.por_unidad[pago.id_unidad].luz_total += luz_lectura;
            analisis.por_unidad[pago.id_unidad].agua_condonada += agua_condonada;
            analisis.por_unidad[pago.id_unidad].luz_condonada += luz_condonada;
            analisis.por_unidad[pago.id_unidad].excedente_agua += excedente_agua;
            analisis.por_unidad[pago.id_unidad].excedente_luz += excedente_luz;
            analisis.por_unidad[pago.id_unidad].pagos_con_servicios++;

            // Agrupar por propiedad (usando prefijo de unidad)
            const prefijo = pago.id_unidad.split('-')[0];
            if (!analisis.por_propiedad[prefijo]) {
              analisis.por_propiedad[prefijo] = {
                prefijo,
                agua_total: 0,
                luz_total: 0,
                agua_condonada: 0,
                luz_condonada: 0,
                unidades: 0
              };
            }

            analisis.por_propiedad[prefijo].agua_total += agua_lectura;
            analisis.por_propiedad[prefijo].luz_total += luz_lectura;
            analisis.por_propiedad[prefijo].agua_condonada += agua_condonada;
            analisis.por_propiedad[prefijo].luz_condonada += luz_condonada;
            analisis.por_propiedad[prefijo].unidades++;
          }
        }
      });

      console.log('Análisis completado:', analisis);
      setDatos(analisis);
      setPagosDetalle(pagosActivos);
    } catch (error) {
      console.error('Error al analizar servicios:', error);
      alert('Error al analizar servicios: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generarRangoBimestral = () => {
    if (!periodoInicio) return;
    
    const [anio, mes] = periodoInicio.split('-').map(Number);
    const siguienteMes = mes === 12 ? 1 : mes + 1;
    const siguienteAnio = mes === 12 ? anio + 1 : anio;
    
    const periodoSiguiente = `${siguienteAnio}-${String(siguienteMes).padStart(2, '0')}`;
    setPeriodoFin(periodoSiguiente);
  };

  const generarRangoTrimestral = () => {
    if (!periodoInicio) return;
    
    const [anio, mes] = periodoInicio.split('-').map(Number);
    let nuevoMes = mes + 2;
    let nuevoAnio = anio;
    
    if (nuevoMes > 12) {
      nuevoMes -= 12;
      nuevoAnio++;
    }
    
    const periodoFinal = `${nuevoAnio}-${String(nuevoMes).padStart(2, '0')}`;
    setPeriodoFin(periodoFinal);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard de Servicios
        </h1>
        <p className="text-gray-600">
          Análisis de consumo de agua y luz por periodo
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Filtros de Análisis</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Periodo Inicio *
            </label>
            <input
              type="month"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Periodo Fin
            </label>
            <input
              type="month"
              value={periodoFin}
              onChange={(e) => setPeriodoFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Propiedad (Prefijo)
            </label>
            <input
              type="text"
              value={propiedadFiltro}
              onChange={(e) => setPropiedadFiltro(e.target.value.toUpperCase())}
              placeholder="Ej: CH"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setPeriodoFin(periodoInicio);
            }}
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 text-sm"
          >
            Mensual
          </button>
          <button
            onClick={generarRangoBimestral}
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm"
          >
            Bimestral
          </button>
          <button
            onClick={generarRangoTrimestral}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-sm"
          >
            Trimestral
          </button>
        </div>

        <button
          onClick={analizarServicios}
          disabled={loading || !periodoInicio}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Analizando...' : 'Analizar Servicios'}
        </button>
      </div>

      {/* Resultados */}
      {datos && (
        <>
          {/* Estadísticas Principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Unidades con Servicios</p>
                  <p className="text-4xl font-bold mt-1">{datos.unidades_con_servicios}</p>
                </div>
                <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <p className="text-blue-100 text-sm">De {datos.total_pagos_analizados} pagos analizados</p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-cyan-100 text-sm font-medium">Agua Condonada</p>
                  <p className="text-4xl font-bold mt-1">${datos.total_agua_condonada}</p>
                </div>
                <div className="bg-cyan-400 bg-opacity-30 rounded-lg p-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                  </svg>
                </div>
              </div>
              <p className="text-cyan-100 text-sm">De ${datos.total_agua_consumida} consumidos</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-yellow-100 text-sm font-medium">Luz Condonada</p>
                  <p className="text-4xl font-bold mt-1">${datos.total_luz_condonada}</p>
                </div>
                <div className="bg-yellow-400 bg-opacity-30 rounded-lg p-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <p className="text-yellow-100 text-sm">De ${datos.total_luz_consumida} consumidos</p>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-red-100 text-sm font-medium">Total Excedentes</p>
                  <p className="text-4xl font-bold mt-1">
                    ${datos.total_excedentes_agua + datos.total_excedentes_luz}
                  </p>
                </div>
                <div className="bg-red-400 bg-opacity-30 rounded-lg p-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-red-100 text-sm">Cobrados a inquilinos</p>
            </div>
          </div>

          {/* Detalles de Excedentes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Excedentes por Servicio</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Agua</span>
                    <span className="font-bold text-cyan-600">${datos.total_excedentes_agua}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-cyan-500 h-3 rounded-full"
                      style={{ 
                        width: `${(datos.total_excedentes_agua / (datos.total_excedentes_agua + datos.total_excedentes_luz || 1)) * 100}%`
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {datos.unidades_excedieron_agua} unidades excedieron el límite
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Luz</span>
                    <span className="font-bold text-yellow-600">${datos.total_excedentes_luz}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-yellow-500 h-3 rounded-full"
                      style={{ 
                        width: `${(datos.total_excedentes_luz / (datos.total_excedentes_agua + datos.total_excedentes_luz || 1)) * 100}%`
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {datos.unidades_excedieron_luz} unidades excedieron el límite
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Cobro de Excedentes</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Cobrados del Depósito</p>
                    <p className="text-2xl font-bold text-purple-600">
                      ${datos.excedentes_cobrados_deposito}
                    </p>
                  </div>
                  <div className="bg-purple-100 rounded-full p-3">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Cobrados de la Renta</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${datos.excedentes_cobrados_renta}
                    </p>
                  </div>
                  <div className="bg-green-100 rounded-full p-3">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Por Propiedad */}
          {Object.keys(datos.por_propiedad).length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Resumen por Propiedad</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.values(datos.por_propiedad).map((prop) => (
                  <div key={prop.prefijo} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-lg text-gray-900 mb-3">{prop.prefijo}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Unidades:</span>
                        <span className="font-semibold">{prop.unidades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Agua consumida:</span>
                        <span className="font-semibold text-cyan-600">${prop.agua_total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Agua condonada:</span>
                        <span className="font-semibold text-cyan-700">${prop.agua_condonada}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Luz consumida:</span>
                        <span className="font-semibold text-yellow-600">${prop.luz_total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Luz condonada:</span>
                        <span className="font-semibold text-yellow-700">${prop.luz_condonada}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla Detallada por Unidad */}
          {Object.keys(datos.por_unidad).length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">
                Detalle por Unidad ({Object.keys(datos.por_unidad).length} unidades)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Agua Consumida
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Agua Condonada
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Excedente Agua
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Luz Consumida
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Luz Condonada
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Excedente Luz
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Excedente
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.values(datos.por_unidad)
                      .sort((a, b) => a.unidad.localeCompare(b.unidad))
                      .map((unidad) => (
                        <tr key={unidad.unidad} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {unidad.unidad}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            ${unidad.agua_total}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-600 font-semibold">
                            ${unidad.agua_condonada}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={unidad.excedente_agua > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                              ${unidad.excedente_agua}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            ${unidad.luz_total}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-semibold">
                            ${unidad.luz_condonada}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={unidad.excedente_luz > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                              ${unidad.excedente_luz}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                            <span className={
                              (unidad.excedente_agua + unidad.excedente_luz) > 0 
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }>
                              ${unidad.excedente_agua + unidad.excedente_luz}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {datos && datos.unidades_con_servicios === 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                No se encontraron pagos con servicios registrados en el periodo seleccionado.
                Verifica que los pagos tengan el campo "servicios" con lecturas de agua o luz mayores a 0.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiciosDashboard;