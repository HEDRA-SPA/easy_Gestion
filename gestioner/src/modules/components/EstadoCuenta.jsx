import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const EstadoCuenta = ({ unidades, inquilinosMap, refrescar }) => {
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [datosEstadoCuenta, setDatosEstadoCuenta] = useState(null);
  const [loading, setLoading] = useState(false);
  const impresionRef = useRef(null);

  // Cargar todo el estado de cuenta del mes
  useEffect(() => {
    const cargarEstadoCuenta = async () => {
      setLoading(true);
      try {
        const periodoStr = `${anioSeleccionado}-${String(mesSeleccionado).padStart(2, '0')}`;
        const resultados = [];

        // Ordenar unidades numéricamente por no_depto
        const unidadesOrdenadas = [...unidades].sort((a, b) => {
          const numA = parseInt(a.no_depto) || 0;
          const numB = parseInt(b.no_depto) || 0;
          return numA - numB;
        });

        // Para cada unidad, obtener datos del mes
        for (const unidad of unidadesOrdenadas) {
          try {
            // Obtener el nombre de la propiedad
            let nombrePropiedad = 'N/A';
            if (unidad.id_propiedad) {
              const propiedadDoc = await getDoc(doc(db, 'propiedades', unidad.id_propiedad));
              if (propiedadDoc.exists()) {
                nombrePropiedad = propiedadDoc.data().nombre || 'N/A';
              }
            }

            // Obtener pagos del mes
            const pagosRef = collection(db, 'pagos');
            const qPagos = query(
              pagosRef,
              where('id_unidad', '==', unidad.id_unidad),
              where('periodo', '==', periodoStr)
            );
            const pagosDocs = await getDocs(qPagos);
            const pagos = pagosDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Obtener contrato para información del período
            const contratosRef = collection(db, 'contratos');
            const qContratos = query(contratosRef, where('id_unidad', '==', unidad.id_unidad));
            const contratosDocs = await getDocs(qContratos);

            let montoEsperado = 0;
            let montoPagado = 0;
            let deuda = 0;
            let tieneInquilino = false;
            let contratoActivoEnPeriodo = false;

            if (contratosDocs.docs.length > 0) {
              const contrato = contratosDocs.docs[0].data();
              
              // Verificar si el contrato estaba activo en el período consultado
              const periodoInfo = contrato.periodos_esperados?.find(p => p.periodo === periodoStr);
              
              if (periodoInfo) {
                // Si existe el período en periodos_esperados, significa que el contrato estaba activo
                contratoActivoEnPeriodo = true;
                tieneInquilino = true;
                montoEsperado = Number(periodoInfo.monto_esperado || 0);
                montoPagado = Number(periodoInfo.monto_pagado || 0);
                deuda = Math.max(0, montoEsperado - montoPagado);
              }
            }

            // Usar el nombre del inquilino directamente de la unidad
            const nombreInquilino = contratoActivoEnPeriodo && unidad.nombre_inquilino 
              ? unidad.nombre_inquilino 
              : 'Sin inquilino asignado';

            resultados.push({
              unidad,
              nombrePropiedad,
              nombreInquilino,
              periodo: periodoStr,
              pagos,
              montoEsperado,
              montoPagado,
              deuda,
              totalPagado: pagos.reduce((sum, p) => sum + Number(p.monto_pagado || 0), 0),
              tieneInquilino: contratoActivoEnPeriodo
            });
          } catch (error) {
            console.error(`Error cargando unidad ${unidad.id_unidad}:`, error);
          }
        }

        const mesNombre = new Date(anioSeleccionado, mesSeleccionado - 1).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long'
        });

        // Calcular totales (solo de unidades con inquilino)
        const unidadesConInquilino = resultados.filter(r => r.tieneInquilino);
        const totalEsperado = unidadesConInquilino.reduce((sum, r) => sum + r.montoEsperado, 0);
        const totalCobrado = unidadesConInquilino.reduce((sum, r) => sum + r.montoPagado, 0);
        const totalDeuda = unidadesConInquilino.reduce((sum, r) => sum + r.deuda, 0);

        setDatosEstadoCuenta({
          periodo: periodoStr,
          mesNombre,
          resultados,
          totalEsperado,
          totalCobrado,
          totalDeuda,
          cantidadUnidades: resultados.length,
          unidadesPagadas: unidadesConInquilino.filter(r => r.deuda === 0).length,
          unidadesAdeudadas: unidadesConInquilino.filter(r => r.deuda > 0).length,
          unidadesSinInquilino: resultados.filter(r => !r.tieneInquilino).length
        });
      } catch (error) {
        console.error('Error cargando estado de cuenta:', error);
        alert('Error al cargar el estado de cuenta');
      } finally {
        setLoading(false);
      }
    };

    cargarEstadoCuenta();
  }, [anioSeleccionado, mesSeleccionado, unidades, inquilinosMap]);

  const imprimirEstadoCuenta = () => {
    if (!datosEstadoCuenta) return;
    
    const ventanaImpresion = window.open('', '', 'height=900,width=1200');
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Estado de Cuenta - ${datosEstadoCuenta.mesNombre}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .contenedor { max-width: 1200px; margin: 0 auto; }
            .encabezado { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #1e40af; padding-bottom: 15px; }
            .titulo { font-size: 28px; font-weight: bold; color: #1e40af; }
            .subtitulo { font-size: 16px; color: #666; margin-top: 5px; }
            .resumen { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            .resumen-item { padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center; border-left: 4px solid #1e40af; }
            .resumen-label { font-size: 11px; color: #666; font-weight: bold; }
            .resumen-valor { font-size: 18px; font-weight: bold; color: #1e40af; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #1e40af; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 11px; }
            td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px; }
            tr:nth-child(even) { background: #f9f9f9; }
            .deuda-positiva { color: #ef4444; font-weight: bold; }
            .pago-completo { color: #10b981; font-weight: bold; }
            .no-aplica { color: #6b7280; font-weight: bold; }
            .seccion-titulo { font-size: 14px; font-weight: bold; color: #fff; background: #1e40af; padding: 10px; margin-top: 15px; margin-bottom: 10px; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
            @media print { body { margin: 0; padding: 10px; } * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; } }
          </style>
        </head>
        <body>
          <div class="contenedor">
            <div class="encabezado">
              <div class="titulo">ESTADO DE CUENTA GENERAL</div>
              <div class="subtitulo">${datosEstadoCuenta.mesNombre.toUpperCase()}</div>
            </div>

            <div class="resumen">
              <div class="resumen-item">
                <div class="resumen-label">TOTAL ESPERADO</div>
                <div class="resumen-valor">$${datosEstadoCuenta.totalEsperado.toFixed(2)}</div>
              </div>
              <div class="resumen-item">
                <div class="resumen-label">TOTAL COBRADO</div>
                <div class="resumen-valor" style="color: #10b981;">$${datosEstadoCuenta.totalCobrado.toFixed(2)}</div>
              </div>
              <div class="resumen-item">
                <div class="resumen-label">TOTAL DEUDA</div>
                <div class="resumen-valor" style="color: #ef4444;">$${datosEstadoCuenta.totalDeuda.toFixed(2)}</div>
              </div>
              <div class="resumen-item">
                <div class="resumen-label">COBRANZA</div>
                <div class="resumen-valor">${datosEstadoCuenta.totalEsperado > 0 ? ((datosEstadoCuenta.totalCobrado / datosEstadoCuenta.totalEsperado * 100).toFixed(1)) : 0}%</div>
              </div>
            </div>

            <div class="seccion-titulo">DETALLE POR UNIDAD</div>
            <table>
              <thead>
                <tr>
                  <th>UNIDAD</th>
                  <th>PROPIEDAD</th>
                  <th>INQUILINO</th>
                  <th style="text-align: right;">ESPERADO</th>
                  <th style="text-align: right;">COBRADO</th>
                  <th style="text-align: right;">DEUDA</th>
                  <th style="text-align: center;">% COBRANZA</th>
                  <th style="text-align: center;">ESTADO</th>
                </tr>
              </thead>
              <tbody>
                ${datosEstadoCuenta.resultados.map(r => {
                  if (!r.tieneInquilino) {
                    return `
                      <tr>
                        <td><strong>${r.unidad?.no_depto || 'N/A'}</strong></td>
                        <td>${r.nombrePropiedad}</td>
                        <td>${r.nombreInquilino}</td>
                        <td style="text-align: right;">-</td>
                        <td style="text-align: right;">-</td>
                        <td style="text-align: right;">-</td>
                        <td style="text-align: center;">-</td>
                        <td class="no-aplica" style="text-align: center;">⊘ NO APLICA</td>
                      </tr>
                    `;
                  }
                  
                  const porcentajeCobranza = r.montoEsperado > 0 ? ((r.montoPagado / r.montoEsperado) * 100).toFixed(0) : 0;
                  const estado = r.deuda === 0 ? '✓ PAGADO' : '✗ DEUDA';
                  return `
                    <tr>
                      <td><strong>${r.unidad?.no_depto || 'N/A'}</strong></td>
                      <td>${r.nombrePropiedad}</td>
                      <td>${r.nombreInquilino}</td>
                      <td style="text-align: right;">$${r.montoEsperado.toFixed(2)}</td>
                      <td class="pago-completo" style="text-align: right;">$${r.montoPagado.toFixed(2)}</td>
                      <td ${r.deuda > 0 ? 'class="deuda-positiva"' : ''} style="text-align: right;">$${r.deuda.toFixed(2)}</td>
                      <td style="text-align: center;">${porcentajeCobranza}%</td>
                      <td ${r.deuda > 0 ? 'class="deuda-positiva"' : 'class="pago-completo"'} style="text-align: center;">${estado}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="seccion-titulo">RESUMEN GENERAL</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50%;">CONCEPTO</th>
                  <th style="width: 50%;">VALOR</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total de Unidades</td>
                  <td><strong>${datosEstadoCuenta.cantidadUnidades}</strong></td>
                </tr>
                <tr>
                  <td>Unidades Ocupadas</td>
                  <td><strong>${datosEstadoCuenta.cantidadUnidades - datosEstadoCuenta.unidadesSinInquilino}</strong></td>
                </tr>
                <tr>
                  <td>Unidades Disponibles</td>
                  <td class="no-aplica"><strong>${datosEstadoCuenta.unidadesSinInquilino}</strong></td>
                </tr>
                <tr>
                  <td>Unidades Pagadas (al día)</td>
                  <td class="pago-completo"><strong>${datosEstadoCuenta.unidadesPagadas}</strong></td>
                </tr>
                <tr>
                  <td>Unidades con Deuda</td>
                  <td class="deuda-positiva"><strong>${datosEstadoCuenta.unidadesAdeudadas}</strong></td>
                </tr>
                <tr>
                  <td><strong>Total Esperado</strong></td>
                  <td><strong>$${datosEstadoCuenta.totalEsperado.toFixed(2)}</strong></td>
                </tr>
                <tr>
                  <td><strong>Total Cobrado</strong></td>
                  <td class="pago-completo"><strong>$${datosEstadoCuenta.totalCobrado.toFixed(2)}</strong></td>
                </tr>
                <tr>
                  <td><strong>Total Deuda</strong></td>
                  <td class="deuda-positiva"><strong>$${datosEstadoCuenta.totalDeuda.toFixed(2)}</strong></td>
                </tr>
                <tr>
                  <td><strong>Porcentaje de Cobranza</strong></td>
                  <td><strong>${datosEstadoCuenta.totalEsperado > 0 ? ((datosEstadoCuenta.totalCobrado / datosEstadoCuenta.totalEsperado * 100).toFixed(2)) : 0}%</strong></td>
                </tr>
              </tbody>
            </table>

            <div class="footer">
              <p>Documento generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    ventanaImpresion.document.write(html);
    ventanaImpresion.document.close();
    ventanaImpresion.print();
  };

  // Obtener lista de meses
  const mesesDisponibles = useMemo(() => {
    const meses = [];
    for (let i = 0; i < 12; i++) {
      const valor = i + 1;
      const nombre = new Date(2000, i, 1).toLocaleDateString('es-ES', { month: 'long' });
      meses.push({ valor, nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1) });
    }
    return meses;
  }, []);

  // Obtener años disponibles
  const aniosDisponibles = useMemo(() => {
    const anos = [];
    const anioActual = new Date().getFullYear();
    for (let i = anioActual - 5; i <= anioActual + 1; i++) {
      anos.push(i);
    }
    return anos;
  }, []);

  return (
    <div className="w-full no-print">
      {/* HEADER CON TÍTULO Y DESCRIPCIÓN */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl"><i className="fa-solid fa-chart-simple"></i></span>
              Estado de Cuenta Mensual
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Resumen completo de cobros, deudas y ocupación de las propiedades
            </p>
          </div>
        </div>
      </div>

      {/* PANEL PRINCIPAL */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        
        {/* Controles de selección */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2">Año</label>
            <select
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent text-sm font-medium shadow-sm"
            >
              {aniosDisponibles.map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2">Mes</label>
            <select
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(Number(e.target.value))}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent text-sm font-medium shadow-sm"
            >
              {mesesDisponibles.map(mes => (
                <option key={mes.valor} value={mes.valor}>{mes.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Estado de cuenta */}
        {loading && (
          <div className="text-center py-12 sm:py-16 text-gray-500">
            <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-slate-800 rounded-full animate-spin mb-3"></div>
            <div className="text-sm sm:text-base">Cargando estado de cuenta...</div>
          </div>
        )}

        {datosEstadoCuenta && !loading && (
          <div ref={impresionRef} className="space-y-4 sm:space-y-6">
            {/* Resumen general - Responsive Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-blue-50 p-3 sm:p-4 rounded-xl border border-blue-200">
                <p className="text-[10px] sm:text-xs font-semibold text-blue-600 uppercase">Total Esperado</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 sm:mt-2">${datosEstadoCuenta.totalEsperado.toFixed(2)}</p>
              </div>
              <div className="bg-green-50 p-3 sm:p-4 rounded-xl border border-green-200">
                <p className="text-[10px] sm:text-xs font-semibold text-green-600 uppercase">Total Cobrado</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600 mt-1 sm:mt-2">${datosEstadoCuenta.totalCobrado.toFixed(2)}</p>
              </div>
              <div className="bg-red-50 p-3 sm:p-4 rounded-xl border border-red-200">
                <p className="text-[10px] sm:text-xs font-semibold text-red-600 uppercase">Total Deuda</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600 mt-1 sm:mt-2">${datosEstadoCuenta.totalDeuda.toFixed(2)}</p>
              </div>
              <div className="bg-purple-50 p-3 sm:p-4 rounded-xl border border-purple-200">
                <p className="text-[10px] sm:text-xs font-semibold text-purple-600 uppercase">Cobranza</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 mt-1 sm:mt-2">{datosEstadoCuenta.totalEsperado > 0 ? ((datosEstadoCuenta.totalCobrado / datosEstadoCuenta.totalEsperado * 100).toFixed(1)) : 0}%</p>
              </div>
            </div>

            {/* Tabla de unidades - Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-4 py-3 text-left text-xs font-semibold">UNIDAD</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">PROPIEDAD</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">INQUILINO</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold">ESPERADO</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold">COBRADO</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold">DEUDA</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">%</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {datosEstadoCuenta.resultados.map((r, idx) => {
                    if (!r.tieneInquilino) {
                      return (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{r.unidad?.no_depto || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{r.nombrePropiedad}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 italic">{r.nombreInquilino}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-400">-</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-400">-</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-400">-</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-400">-</td>
                          <td className="px-4 py-3 text-xs text-center font-semibold text-gray-500">⊘ NO APLICA</td>
                        </tr>
                      );
                    }

                    const porcentajeCobranza = r.montoEsperado > 0 ? ((r.montoPagado / r.montoEsperado) * 100).toFixed(0) : 0;
                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">{r.unidad?.no_depto || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{r.nombrePropiedad}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{r.nombreInquilino}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">${r.montoEsperado.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600">${r.montoPagado.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${r.deuda > 0 ? 'text-red-600' : 'text-green-600'}`}>${r.deuda.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium">{porcentajeCobranza}%</td>
                        <td className={`px-4 py-3 text-xs text-center font-semibold ${r.deuda > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {r.deuda > 0 ? '✗ DEUDA' : '✓ PAGADO'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards de unidades - Mobile */}
            <div className="lg:hidden space-y-3">
              {datosEstadoCuenta.resultados.map((r, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-lg font-bold text-gray-800">Unidad {r.unidad?.no_depto || 'N/A'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{r.nombrePropiedad}</div>
                    </div>
                    {r.tieneInquilino && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        r.deuda > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {r.deuda > 0 ? '✗ DEUDA' : '✓ PAGADO'}
                      </span>
                    )}
                    {!r.tieneInquilino && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        ⊘ VACÍO
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-700 mb-3">
                    <span className="font-medium">Inquilino:</span> {r.nombreInquilino}
                  </div>

                  {r.tieneInquilino ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                        <div className="text-[10px] font-semibold text-blue-600 uppercase">Esperado</div>
                        <div className="text-base font-bold text-blue-700 mt-0.5">${r.montoEsperado.toFixed(2)}</div>
                      </div>
                      <div className="bg-green-50 p-2.5 rounded-lg border border-green-100">
                        <div className="text-[10px] font-semibold text-green-600 uppercase">Cobrado</div>
                        <div className="text-base font-bold text-green-700 mt-0.5">${r.montoPagado.toFixed(2)}</div>
                      </div>
                      <div className={`p-2.5 rounded-lg border ${r.deuda > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                        <div className={`text-[10px] font-semibold uppercase ${r.deuda > 0 ? 'text-red-600' : 'text-gray-600'}`}>Deuda</div>
                        <div className={`text-base font-bold mt-0.5 ${r.deuda > 0 ? 'text-red-700' : 'text-gray-700'}`}>${r.deuda.toFixed(2)}</div>
                      </div>
                      <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-100">
                        <div className="text-[10px] font-semibold text-purple-600 uppercase">Cobranza</div>
                        <div className="text-base font-bold text-purple-700 mt-0.5">
                          {r.montoEsperado > 0 ? ((r.montoPagado / r.montoEsperado) * 100).toFixed(0) : 0}%
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-lg text-center text-sm text-gray-500 italic border border-gray-200">
                      Sin actividad en este período
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Resumen general de unidades */}
            <div className="bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200">
              <h3 className="text-sm sm:text-base font-semibold text-gray-700 mb-3 sm:mb-4">Resumen de Unidades</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Unidades</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{datosEstadoCuenta.cantidadUnidades}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Disponibles</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-500 mt-1">{datosEstadoCuenta.unidadesSinInquilino}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-green-600">Al Día</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{datosEstadoCuenta.unidadesPagadas}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-red-600">Con Deuda</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{datosEstadoCuenta.unidadesAdeudadas}</p>
                </div>
              </div>
            </div>

            {/* Botón de impresión */}
            <div className="flex gap-3 pt-2 sm:pt-4">
              <button
                onClick={imprimirEstadoCuenta}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-xl transition-all shadow-sm text-sm sm:text-base"
              >
                Imprimir Estado de Cuenta
              </button>
            </div>
          </div>
        )}

        {!datosEstadoCuenta && !loading && (
          <div className="text-center py-12 sm:py-16 text-gray-500">
            <div className="text-4xl sm:text-5xl mb-3">📊</div>
            <p className="text-sm sm:text-base">Selecciona un mes para ver el estado de cuenta</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EstadoCuenta;