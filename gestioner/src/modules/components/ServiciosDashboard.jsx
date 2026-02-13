import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

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
      // 🔥 PASO 1: Obtener configuración de límites desde Firestore
      const propRef = doc(db, 'propiedades', 'chilpancingo');
      const propSnap = await getDoc(propRef);
      let LIMITE_AGUA_CONFIG = 250;
      let LIMITE_LUZ_CONFIG = 250;
      let LIMITE_INTERNET_CONFIG = 250;
      
      if (propSnap.exists()) {
        const configData = propSnap.data();
        LIMITE_AGUA_CONFIG = Number(configData.limite_agua || 250);
        LIMITE_LUZ_CONFIG = Number(configData.limite_luz || 250);
        LIMITE_INTERNET_CONFIG = Number(configData.limite_internet || 250);
        console.log(`✅ Límites configurados - Agua: ${LIMITE_AGUA_CONFIG}, Luz: ${LIMITE_LUZ_CONFIG}, Internet: ${LIMITE_INTERNET_CONFIG}`);
      }

      // 🔥 PASO 2: Obtener TODOS los pagos sin filtro de Firestore
      console.log('Obteniendo todos los pagos...');
      const pagosSnapshot = await getDocs(collection(db, 'pagos'));
      const pagosData = [];
      
      pagosSnapshot.forEach((doc) => {
        pagosData.push({ id: doc.id, ...doc.data() });
      });

      console.log(`Total de pagos en BD: ${pagosData.length}`);

      // 🔥 PASO 3: Filtrar por periodo EN MEMORIA (igual que antes)
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

      // 🔥 PASO 4: Analizar servicios (LÓGICA ACTUALIZADA con Internet)
      const analisis = {
        total_pagos_analizados: pagosFiltrados.length,
        total_agua_consumida: 0,
        total_luz_consumida: 0,
        total_internet_consumida: 0,
        total_agua_condonada: 0,
        total_luz_condonada: 0,
        total_internet_condonada: 0,
        unidades_con_servicios: 0,
        unidades_excedieron_agua: 0,
        unidades_excedieron_luz: 0,
        unidades_excedieron_internet: 0,
        excedentes_cobrados_deposito: 0,
        excedentes_cobrados_renta: 0,
        total_excedentes_agua: 0,
        total_excedentes_luz: 0,
        total_excedentes_internet: 0,
        por_unidad: {},
        por_propiedad: {}
      };

      // 🔥 LÓGICA: Igual que ReporteFinancieroGlobal pero con Internet
      pagosFiltrados.forEach(pago => {
        if (pago.servicios) {
          const { 
            agua_lectura = 0, 
            luz_lectura = 0,
            internet_lectura = 0,
            limite_agua_aplicado = LIMITE_AGUA_CONFIG,
            limite_luz_aplicado = LIMITE_LUZ_CONFIG,
            limite_internet_aplicado = LIMITE_INTERNET_CONFIG,
            excedentes_cobrados_de = 'deposito',
            excedentes_del_deposito = 0
          } = pago.servicios;

          console.log(`📊 Unidad ${pago.id_unidad} (${pago.periodo}): Agua=${agua_lectura}, Luz=${luz_lectura}, Internet=${internet_lectura}`);
          
          // Solo incrementar si hay consumo REAL mayor a 0
          if (agua_lectura > 0 || luz_lectura > 0 || internet_lectura > 0) {
            analisis.unidades_con_servicios++;

            // Sumar consumos totales
            analisis.total_agua_consumida += agua_lectura;
            analisis.total_luz_consumida += luz_lectura;
            analisis.total_internet_consumida += internet_lectura;

            // 🔥 CALCULAR LO CONDONADO (lo que NOSOTROS pagamos)
            const agua_condonada = Math.min(agua_lectura, limite_agua_aplicado);
            const luz_condonada = Math.min(luz_lectura, limite_luz_aplicado);
            const internet_condonada = Math.min(internet_lectura, limite_internet_aplicado);
            
            analisis.total_agua_condonada += agua_condonada;
            analisis.total_luz_condonada += luz_condonada;
            analisis.total_internet_condonada += internet_condonada;

            // Calcular excedentes (lo que el inquilino paga)
            const excedente_agua = Math.max(0, agua_lectura - limite_agua_aplicado);
            const excedente_luz = Math.max(0, luz_lectura - limite_luz_aplicado);
            const excedente_internet = Math.max(0, internet_lectura - limite_internet_aplicado);
            
            if (excedente_agua > 0) analisis.unidades_excedieron_agua++;
            if (excedente_luz > 0) analisis.unidades_excedieron_luz++;
            if (excedente_internet > 0) analisis.unidades_excedieron_internet++;

            analisis.total_excedentes_agua += excedente_agua;
            analisis.total_excedentes_luz += excedente_luz;
            analisis.total_excedentes_internet += excedente_internet;

            // Contar de dónde se cobraron excedentes
            if (excedentes_cobrados_de === 'deposito') {
              analisis.excedentes_cobrados_deposito += excedentes_del_deposito;
            } else {
              const total_excedente = excedente_agua + excedente_luz + excedente_internet;
              analisis.excedentes_cobrados_renta += total_excedente;
            }

            // Agrupar por unidad
            if (!analisis.por_unidad[pago.id_unidad]) {
              analisis.por_unidad[pago.id_unidad] = {
                unidad: pago.id_unidad,
                agua_total: 0,
                luz_total: 0,
                internet_total: 0,
                agua_condonada: 0,
                luz_condonada: 0,
                internet_condonada: 0,
                excedente_agua: 0,
                excedente_luz: 0,
                excedente_internet: 0,
                pagos_con_servicios: 0
              };
            }

            analisis.por_unidad[pago.id_unidad].agua_total += agua_lectura;
            analisis.por_unidad[pago.id_unidad].luz_total += luz_lectura;
            analisis.por_unidad[pago.id_unidad].internet_total += internet_lectura;
            analisis.por_unidad[pago.id_unidad].agua_condonada += agua_condonada;
            analisis.por_unidad[pago.id_unidad].luz_condonada += luz_condonada;
            analisis.por_unidad[pago.id_unidad].internet_condonada += internet_condonada;
            analisis.por_unidad[pago.id_unidad].excedente_agua += excedente_agua;
            analisis.por_unidad[pago.id_unidad].excedente_luz += excedente_luz;
            analisis.por_unidad[pago.id_unidad].excedente_internet += excedente_internet;
            analisis.por_unidad[pago.id_unidad].pagos_con_servicios++;

            // Agrupar por propiedad (usando prefijo de unidad)
            const prefijo = pago.id_unidad.split('-')[0];
            if (!analisis.por_propiedad[prefijo]) {
              analisis.por_propiedad[prefijo] = {
                prefijo,
                agua_total: 0,
                luz_total: 0,
                internet_total: 0,
                agua_condonada: 0,
                luz_condonada: 0,
                internet_condonada: 0,
                excedente_agua: 0,
                excedente_luz: 0,
                excedente_internet: 0,
                unidades: 0
              };
            }

            analisis.por_propiedad[prefijo].agua_total += agua_lectura;
            analisis.por_propiedad[prefijo].luz_total += luz_lectura;
            analisis.por_propiedad[prefijo].internet_total += internet_lectura;
            analisis.por_propiedad[prefijo].agua_condonada += agua_condonada;
            analisis.por_propiedad[prefijo].luz_condonada += luz_condonada;
            analisis.por_propiedad[prefijo].internet_condonada += internet_condonada;
            analisis.por_propiedad[prefijo].excedente_agua += excedente_agua;
            analisis.por_propiedad[prefijo].excedente_luz += excedente_luz;
            analisis.por_propiedad[prefijo].excedente_internet += excedente_internet;
            analisis.por_propiedad[prefijo].unidades++;
          }
        }
      });

      console.log('✅ Análisis completado:', analisis);
      console.log(`📊 Resumen: ${analisis.unidades_con_servicios} unidades, Agua: $${analisis.total_agua_condonada}, Luz: $${analisis.total_luz_condonada}, Internet: $${analisis.total_internet_condonada}`);
      
      setDatos(analisis);
      setPagosDetalle(pagosFiltrados);
    } catch (error) {
      console.error('❌ Error al analizar servicios:', error);
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
    <div className="w-full no-print">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl"><i className="fa-solid fa-chart-line"></i></span>
              Dashboard de Servicios
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Análisis de consumo de agua, luz e internet por periodo
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
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
            onClick={() => setPeriodoFin(periodoInicio)}
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
          {/* Estadísticas Principales - 5 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Unidades</p>
                  <p className="text-4xl font-bold mt-1">{datos.unidades_con_servicios}</p>
                </div>
                <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <p className="text-blue-100 text-xs">con servicios</p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-cyan-100 text-sm font-medium">Agua</p>
                  <p className="text-3xl font-bold mt-1">${datos.total_agua_condonada}</p>
                </div>
                <div className="bg-cyan-400 bg-opacity-30 rounded-lg p-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-cyan-100 text-xs">condonados</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-yellow-100 text-sm font-medium">Luz</p>
                  <p className="text-3xl font-bold mt-1">${datos.total_luz_condonada}</p>
                </div>
                <div className="bg-yellow-400 bg-opacity-30 rounded-lg p-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <p className="text-yellow-100 text-xs">condonados</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Internet</p>
                  <p className="text-3xl font-bold mt-1">${datos.total_internet_condonada}</p>
                </div>
                <div className="bg-purple-400 bg-opacity-30 rounded-lg p-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                </div>
              </div>
              <p className="text-purple-100 text-xs">condonados</p>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-red-100 text-sm font-medium">Excedentes</p>
                  <p className="text-3xl font-bold mt-1">
                    ${datos.total_excedentes_agua + datos.total_excedentes_luz + datos.total_excedentes_internet}
                  </p>
                </div>
                <div className="bg-red-400 bg-opacity-30 rounded-lg p-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-red-100 text-xs">totales</p>
            </div>
          </div>

          {/* Detalles de Excedentes por Servicio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                      className="bg-cyan-500 h-3 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(datos.total_excedentes_agua / (datos.total_excedentes_agua + datos.total_excedentes_luz + datos.total_excedentes_internet || 1)) * 100}%`
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {datos.unidades_excedieron_agua} unidades excedieron
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Luz</span>
                    <span className="font-bold text-yellow-600">${datos.total_excedentes_luz}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(datos.total_excedentes_luz / (datos.total_excedentes_agua + datos.total_excedentes_luz + datos.total_excedentes_internet || 1)) * 100}%`
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {datos.unidades_excedieron_luz} unidades excedieron
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Internet</span>
                    <span className="font-bold text-purple-600">${datos.total_excedentes_internet}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-purple-500 h-3 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(datos.total_excedentes_internet / (datos.total_excedentes_agua + datos.total_excedentes_luz + datos.total_excedentes_internet || 1)) * 100}%`
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {datos.unidades_excedieron_internet} unidades excedieron
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
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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
                      
                      {/* Agua */}
                      <div className="border-t pt-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Agua consumida:</span>
                          <span className="font-semibold text-cyan-600">${prop.agua_total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Agua condonada:</span>
                          <span className="font-semibold text-cyan-700">${prop.agua_condonada}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Excedente agua:</span>
                          <span className="font-semibold text-red-600">${prop.excedente_agua}</span>
                        </div>
                      </div>

                      {/* Luz */}
                      <div className="border-t pt-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Luz consumida:</span>
                          <span className="font-semibold text-yellow-600">${prop.luz_total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Luz condonada:</span>
                          <span className="font-semibold text-yellow-700">${prop.luz_condonada}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Excedente luz:</span>
                          <span className="font-semibold text-red-600">${prop.excedente_luz}</span>
                        </div>
                      </div>

                      {/* Internet */}
                      <div className="border-t pt-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Internet consumido:</span>
                          <span className="font-semibold text-purple-600">${prop.internet_total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Internet condonado:</span>
                          <span className="font-semibold text-purple-700">${prop.internet_condonada}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Excedente internet:</span>
                          <span className="font-semibold text-red-600">${prop.excedente_internet}</span>
                        </div>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unidad
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-cyan-600 uppercase tracking-wider">
                        Agua Consumida
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-cyan-600 uppercase tracking-wider">
                        Condonada
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-cyan-600 uppercase tracking-wider">
                        Excedente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">
                        Luz Consumida
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">
                        Condonada
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-yellow-600 uppercase tracking-wider">
                        Excedente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Internet Consumido
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Condonado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Excedente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">
                        Total Excedente
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.values(datos.por_unidad)
                      .sort((a, b) => a.unidad.localeCompare(b.unidad))
                      .map((unidad) => (
                        <tr key={unidad.unidad} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {unidad.unidad}
                          </td>
                          
                          {/* Agua */}
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            ${unidad.agua_total}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-cyan-600 font-semibold">
                            ${unidad.agua_condonada}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={unidad.excedente_agua > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                              ${unidad.excedente_agua}
                            </span>
                          </td>
                          
                          {/* Luz */}
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            ${unidad.luz_total}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-yellow-600 font-semibold">
                            ${unidad.luz_condonada}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={unidad.excedente_luz > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                              ${unidad.excedente_luz}
                            </span>
                          </td>
                          
                          {/* Internet */}
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            ${unidad.internet_total}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-purple-600 font-semibold">
                            ${unidad.internet_condonada}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={unidad.excedente_internet > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                              ${unidad.excedente_internet}
                            </span>
                          </td>
                          
                          {/* Total */}
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-bold">
                            <span className={
                              (unidad.excedente_agua + unidad.excedente_luz + unidad.excedente_internet) > 0 
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }>
                              ${unidad.excedente_agua + unidad.excedente_luz + unidad.excedente_internet}
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
                Verifica que los pagos tengan el campo "servicios" con lecturas de agua, luz o internet mayores a 0.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiciosDashboard;