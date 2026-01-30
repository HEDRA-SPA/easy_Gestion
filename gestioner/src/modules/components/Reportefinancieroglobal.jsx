import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ReporteFinancieroGlobal = () => {
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [datosReporte, setDatosReporte] = useState(null);

  useEffect(() => {
    const hoy = new Date();
    const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    setPeriodoInicio(periodoActual);
    setPeriodoFin(periodoActual);
  }, []);

  const generarPeriodos = (inicio, fin) => {
    const periodos = [];
    const [anioInicio, mesInicio] = inicio.split('-').map(Number);
    const [anioFin, mesFin] = fin.split('-').map(Number);

    let anioActual = anioInicio;
    let mesActual = mesInicio;

    while (anioActual < anioFin || (anioActual === anioFin && mesActual <= mesFin)) {
      periodos.push(`${anioActual}-${String(mesActual).padStart(2, '0')}`);
      
      mesActual++;
      if (mesActual > 12) {
        mesActual = 1;
        anioActual++;
      }
    }

    return periodos;
  };

  const formatearPeriodo = (periodo) => {
    const [anio, mes] = periodo.split('-');
    const fecha = new Date(anio, mes - 1, 1);
    return fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
  };

  const generarReporte = async () => {
    if (!periodoInicio || !periodoFin) {
      alert('Por favor selecciona ambos periodos');
      return;
    }

    setLoading(true);
    try {
      const resultado = {
        periodoInicio,
        periodoFin,
        ingresos: {
          total_esperado: 0,
          total_cobrado: 0,
          total_pendiente: 0,
          detalle_por_periodo: []
        },
        egresos: {
          mantenimientos: {
            total: 0,
            cantidad: 0,
            detalle: [],
            por_categoria: {},
            por_estatus: {}
          },
          servicios: {
            agua_condonada: 0,
            luz_condonada: 0,
            total_condonado: 0,
            cantidad_unidades: 0,
            detalle: []
          },
          total_egresos: 0
        },
        balance: {
          utilidad_bruta: 0,
          utilidad_neta: 0,
          margen_utilidad: 0
        }
      };

      const periodosAConsultar = generarPeriodos(periodoInicio, periodoFin);
      
      // ============================================
      // 1. OBTENER INGRESOS (RENTAS)
      // ============================================
      for (const periodo of periodosAConsultar) {
        let ingresoEsperado = 0;
        let ingresoCobrado = 0;
        let ingresoPendiente = 0;

        const contratosRef = collection(db, 'contratos');
        const contratosSnapshot = await getDocs(contratosRef);

        contratosSnapshot.forEach((contratoDoc) => {
          const contrato = contratoDoc.data();
          const periodoInfo = contrato.periodos_esperados?.find(p => p.periodo === periodo);
          
          if (periodoInfo) {
            const esperado = Number(periodoInfo.monto_esperado || 0);
            const pagado = Number(periodoInfo.monto_pagado || 0);
            
            ingresoEsperado += esperado;
            ingresoCobrado += pagado;
            ingresoPendiente += Math.max(0, esperado - pagado);
          }
        });

        resultado.ingresos.detalle_por_periodo.push({
          periodo,
          esperado: ingresoEsperado,
          cobrado: ingresoCobrado,
          pendiente: ingresoPendiente
        });

        resultado.ingresos.total_esperado += ingresoEsperado;
        resultado.ingresos.total_cobrado += ingresoCobrado;
        resultado.ingresos.total_pendiente += ingresoPendiente;
      }

      // ============================================
      // 2. OBTENER EGRESOS - MANTENIMIENTOS
      // ============================================
      const mantenimientosRef = collection(db, 'mantenimientos');
      const qMantenimientos = query(
        mantenimientosRef,
        where('periodo', '>=', periodoInicio),
        where('periodo', '<=', periodoFin)
      );
      const mantenimientosSnapshot = await getDocs(qMantenimientos);

      mantenimientosSnapshot.forEach((doc) => {
        const mant = doc.data();
        
        // Excluir mantenimientos cancelados ya que no representan gastos reales
        if (mant.estatus === 'cancelado') return;
        
        const costo = Number(mant.costo_real || mant.costo_estimado || 0);
        
        resultado.egresos.mantenimientos.total += costo;
        resultado.egresos.mantenimientos.cantidad++;
        
        resultado.egresos.mantenimientos.detalle.push({
          id: doc.id,
          periodo: mant.periodo,
          unidad: mant.id_unidad,
          concepto: mant.concepto,
          descripcion: mant.descripcion,
          categoria: mant.categoria,
          tipo: mant.tipo,
          prioridad: mant.prioridad,
          costo: costo,
          estatus: mant.estatus,
          responsable: mant.responsable
        });

        // Agrupar por categoría
        if (!resultado.egresos.mantenimientos.por_categoria[mant.categoria]) {
          resultado.egresos.mantenimientos.por_categoria[mant.categoria] = 0;
        }
        resultado.egresos.mantenimientos.por_categoria[mant.categoria] += costo;

        // Agrupar por estatus
        if (!resultado.egresos.mantenimientos.por_estatus[mant.estatus]) {
          resultado.egresos.mantenimientos.por_estatus[mant.estatus] = 0;
        }
        resultado.egresos.mantenimientos.por_estatus[mant.estatus] += costo;
      });

      // ============================================
      // 3. OBTENER EGRESOS - SERVICIOS CONDONADOS
      // ============================================
      const pagosRef = collection(db, 'pagos');
      const qPagos = query(
        pagosRef,
        where('periodo', '>=', periodoInicio),
        where('periodo', '<=', periodoFin)
      );
      const pagosSnapshot = await getDocs(qPagos);

      pagosSnapshot.forEach((doc) => {
        const pago = doc.data();
        
        if (pago.servicios) {
          const {
            agua_lectura = 0,
            luz_lectura = 0,
            limite_agua_aplicado = 250,
            limite_luz_aplicado = 250
          } = pago.servicios;

          // Calcular lo condonado (lo que NOSOTROS pagamos)
          const agua_condonada = Math.min(agua_lectura, limite_agua_aplicado);
          const luz_condonada = Math.min(luz_lectura, limite_luz_aplicado);

          resultado.egresos.servicios.agua_condonada += agua_condonada;
          resultado.egresos.servicios.luz_condonada += luz_condonada;

          if (agua_condonada > 0 || luz_condonada > 0) {
            resultado.egresos.servicios.cantidad_unidades++;
            resultado.egresos.servicios.detalle.push({
              periodo: pago.periodo,
              unidad: pago.id_unidad,
              agua_condonada,
              luz_condonada,
              total_condonado: agua_condonada + luz_condonada
            });
          }
        }
      });

      resultado.egresos.servicios.total_condonado = 
        resultado.egresos.servicios.agua_condonada + 
        resultado.egresos.servicios.luz_condonada;

      // ============================================
      // 4. CALCULAR TOTALES Y BALANCE
      // ============================================
      resultado.egresos.total_egresos = 
        resultado.egresos.mantenimientos.total + 
        resultado.egresos.servicios.total_condonado;

      resultado.balance.utilidad_bruta = 
        resultado.ingresos.total_cobrado - resultado.egresos.total_egresos;
      
      resultado.balance.utilidad_neta = resultado.balance.utilidad_bruta;
      
      resultado.balance.margen_utilidad = resultado.ingresos.total_cobrado > 0
        ? (resultado.balance.utilidad_neta / resultado.ingresos.total_cobrado) * 100
        : 0;

      setDatosReporte(resultado);
    } catch (error) {
      console.error('Error generando reporte:', error);
      alert('Error al generar reporte: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const imprimirReporte = () => {
    if (!datosReporte) return;

    const ventanaImpresion = window.open('', '', 'height=900,width=1200');
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte Financiero Global</title>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Arial', sans-serif; 
              padding: 20px; 
              color: #1a1a1a;
              background: #f5f5f5;
            }
            .contenedor { 
              max-width: 1200px; 
              margin: 0 auto; 
              background: white;
              padding: 30px;
              box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            
            .encabezado { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 4px solid #2563eb; 
              padding-bottom: 20px; 
            }
            .titulo { 
              font-size: 32px; 
              font-weight: bold; 
              color: #2563eb; 
              margin-bottom: 8px;
            }
            .subtitulo { 
              font-size: 16px; 
              color: #666; 
              margin-top: 8px; 
            }
            .periodo-badge {
              display: inline-block;
              background: #dbeafe;
              color: #1e40af;
              padding: 6px 16px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: bold;
              margin-top: 10px;
            }

            .resumen-cards {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            .card {
              padding: 20px;
              border-radius: 12px;
              color: white;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .card.ingresos {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            }
            .card.egresos {
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            }
            .card.utilidad {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            }
            .card-label {
              font-size: 12px;
              opacity: 0.9;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 8px;
            }
            .card-valor {
              font-size: 32px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .card-detalle {
              font-size: 13px;
              opacity: 0.85;
            }

            .seccion {
              margin-bottom: 30px;
              background: #fafafa;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #2563eb;
            }
            .seccion-titulo {
              font-size: 18px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 15px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              background: white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            th {
              background: #2563eb;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 13px;
            }
            tr:hover {
              background: #f9fafb;
            }

            .badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .badge.pendiente { background: #fef3c7; color: #92400e; }
            .badge.proceso { background: #dbeafe; color: #1e40af; }
            .badge.completado { background: #d1fae5; color: #065f46; }

            .balance-final {
              background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
              color: white;
              padding: 25px;
              border-radius: 12px;
              margin-top: 30px;
            }
            .balance-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 15px;
            }
            .balance-item {
              text-align: center;
              padding: 15px;
              background: rgba(255,255,255,0.1);
              border-radius: 8px;
            }
            .balance-item-label {
              font-size: 12px;
              opacity: 0.9;
              margin-bottom: 8px;
            }
            .balance-item-valor {
              font-size: 28px;
              font-weight: bold;
            }

            .row-total {
              background: #f3f4f6 !important;
              font-weight: bold;
              border-top: 2px solid #2563eb;
            }

            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              font-size: 11px;
              color: #9ca3af;
            }

            @media print {
              body { margin: 0; padding: 10px; background: white; }
              .contenedor { box-shadow: none; }
              * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            }

            .numero-positivo { color: #059669; font-weight: bold; }
            .numero-negativo { color: #dc2626; font-weight: bold; }

            .stats-mini {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin: 15px 0;
            }
            .stat-box {
              background: white;
              padding: 12px;
              border-radius: 8px;
              border: 2px solid #e5e7eb;
              text-align: center;
            }
            .stat-label {
              font-size: 10px;
              color: #6b7280;
              font-weight: bold;
              text-transform: uppercase;
            }
            .stat-valor {
              font-size: 20px;
              font-weight: bold;
              color: #2563eb;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="contenedor">
            <div class="encabezado">
              <div class="titulo">📊 REPORTE FINANCIERO GLOBAL</div>
              <div class="subtitulo">Estado de Resultados Completo con Ingresos y Egresos</div>
              <div class="periodo-badge">
                ${datosReporte.periodoInicio === datosReporte.periodoFin 
                  ? formatearPeriodo(datosReporte.periodoInicio)
                  : `${formatearPeriodo(datosReporte.periodoInicio)} - ${formatearPeriodo(datosReporte.periodoFin)}`
                }
              </div>
            </div>

            <div class="resumen-cards">
              <div class="card ingresos">
                <div class="card-label">💰 Ingresos Totales</div>
                <div class="card-valor">$${datosReporte.ingresos.total_cobrado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                <div class="card-detalle">
                  Esperado: $${datosReporte.ingresos.total_esperado.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                </div>
              </div>

              <div class="card egresos">
                <div class="card-label">💸 Egresos Totales</div>
                <div class="card-valor">$${datosReporte.egresos.total_egresos.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                <div class="card-detalle">
                  Mantenimiento + Servicios
                </div>
              </div>

              <div class="card utilidad">
                <div class="card-label">📈 Utilidad Neta</div>
                <div class="card-valor">$${datosReporte.balance.utilidad_neta.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                <div class="card-detalle">
                  Margen: ${datosReporte.balance.margen_utilidad.toFixed(1)}%
                </div>
              </div>
            </div>

            <div class="seccion">
              <div class="seccion-titulo">💰 INGRESOS POR RENTAS</div>
              <table>
                <thead>
                  <tr>
                    <th>PERIODO</th>
                    <th style="text-align: right;">ESPERADO</th>
                    <th style="text-align: right;">COBRADO</th>
                    <th style="text-align: right;">PENDIENTE</th>
                    <th style="text-align: center;">% COBRANZA</th>
                  </tr>
                </thead>
                <tbody>
                  ${datosReporte.ingresos.detalle_por_periodo.map(p => {
                    const porcentaje = p.esperado > 0 ? ((p.cobrado / p.esperado) * 100).toFixed(1) : 0;
                    return `
                      <tr>
                        <td><strong>${formatearPeriodo(p.periodo)}</strong></td>
                        <td style="text-align: right;">$${p.esperado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                        <td style="text-align: right;" class="numero-positivo">$${p.cobrado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                        <td style="text-align: right;" class="${p.pendiente > 0 ? 'numero-negativo' : ''}">
                          $${p.pendiente.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                        </td>
                        <td style="text-align: center;">${porcentaje}%</td>
                      </tr>
                    `;
                  }).join('')}
                  <tr class="row-total">
                    <td>TOTALES</td>
                    <td style="text-align: right;">$${datosReporte.ingresos.total_esperado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                    <td style="text-align: right;">$${datosReporte.ingresos.total_cobrado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                    <td style="text-align: right;">$${datosReporte.ingresos.total_pendiente.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                    <td style="text-align: center;">
                      ${datosReporte.ingresos.total_esperado > 0 
                        ? ((datosReporte.ingresos.total_cobrado / datosReporte.ingresos.total_esperado) * 100).toFixed(1) 
                        : 0}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="seccion">
              <div class="seccion-titulo">🔧 EGRESOS - MANTENIMIENTOS</div>
              
              <div class="stats-mini">
                <div class="stat-box">
                  <div class="stat-label">Total Gastado</div>
                  <div class="stat-valor" style="color: #dc2626;">$${datosReporte.egresos.mantenimientos.total.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Cantidad</div>
                  <div class="stat-valor">${datosReporte.egresos.mantenimientos.cantidad}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Promedio</div>
                  <div class="stat-valor" style="color: #f59e0b;">
                    $${datosReporte.egresos.mantenimientos.cantidad > 0 
                      ? (datosReporte.egresos.mantenimientos.total / datosReporte.egresos.mantenimientos.cantidad).toLocaleString('es-MX', {minimumFractionDigits: 2})
                      : '0.00'
                    }
                  </div>
                </div>
              </div>

              ${datosReporte.egresos.mantenimientos.detalle.length > 0 ? `
                <table>
                  <thead>
                    <tr>
                      <th>PERIODO</th>
                      <th>UNIDAD</th>
                      <th>CONCEPTO</th>
                      <th>CATEGORÍA</th>
                      <th>TIPO</th>
                      <th style="text-align: right;">COSTO</th>
                      <th style="text-align: center;">ESTADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${datosReporte.egresos.mantenimientos.detalle.map(m => `
                      <tr>
                        <td>${formatearPeriodo(m.periodo)}</td>
                        <td><strong>${m.unidad}</strong></td>
                        <td>${m.concepto}</td>
                        <td><span class="badge">${m.categoria}</span></td>
                        <td>${m.tipo}</td>
                        <td style="text-align: right;" class="numero-negativo">$${m.costo.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                        <td style="text-align: center;">
                          <span class="badge ${m.estatus}">${m.estatus}</span>
                        </td>
                      </tr>
                    `).join('')}
                    <tr class="row-total">
                      <td colspan="5">TOTAL MANTENIMIENTOS</td>
                      <td style="text-align: right;">$${datosReporte.egresos.mantenimientos.total.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              ` : '<p style="text-align: center; color: #6b7280; padding: 20px;">✅ No hay gastos de mantenimiento en este periodo</p>'}
            </div>

            <div class="seccion">
              <div class="seccion-titulo">💧⚡ EGRESOS - SERVICIOS CONDONADOS</div>
              
              <div class="stats-mini">
                <div class="stat-box">
                  <div class="stat-label">Agua Condonada</div>
                  <div class="stat-valor" style="color: #06b6d4;">$${datosReporte.egresos.servicios.agua_condonada.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Luz Condonada</div>
                  <div class="stat-valor" style="color: #f59e0b;">$${datosReporte.egresos.servicios.luz_condonada.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Total Condonado</div>
                  <div class="stat-valor" style="color: #dc2626;">$${datosReporte.egresos.servicios.total_condonado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                </div>
              </div>

              ${datosReporte.egresos.servicios.detalle.length > 0 ? `
                <table>
                  <thead>
                    <tr>
                      <th>PERIODO</th>
                      <th>UNIDAD</th>
                      <th style="text-align: right;">AGUA</th>
                      <th style="text-align: right;">LUZ</th>
                      <th style="text-align: right;">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${datosReporte.egresos.servicios.detalle.map(s => `
                      <tr>
                        <td>${formatearPeriodo(s.periodo)}</td>
                        <td><strong>${s.unidad}</strong></td>
                        <td style="text-align: right;">$${s.agua_condonada.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                        <td style="text-align: right;">$${s.luz_condonada.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                        <td style="text-align: right;" class="numero-negativo">$${s.total_condonado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                      </tr>
                    `).join('')}
                    <tr class="row-total">
                      <td colspan="2">TOTAL SERVICIOS</td>
                      <td style="text-align: right;">$${datosReporte.egresos.servicios.agua_condonada.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                      <td style="text-align: right;">$${datosReporte.egresos.servicios.luz_condonada.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                      <td style="text-align: right;">$${datosReporte.egresos.servicios.total_condonado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                    </tr>
                  </tbody>
                </table>
              ` : '<p style="text-align: center; color: #6b7280; padding: 20px;">✅ No hay servicios condonados en este periodo</p>'}
            </div>

            <div class="balance-final">
              <h3 style="font-size: 20px; margin-bottom: 5px;">📈 BALANCE FINANCIERO DEL PERIODO</h3>
              <p style="font-size: 13px; opacity: 0.9; margin-bottom: 15px;">Resumen de Ganancias y Rentabilidad Real</p>
              
              <div class="balance-grid">
                <div class="balance-item">
                  <div class="balance-item-label">Ingresos Cobrados</div>
                  <div class="balance-item-valor">$${datosReporte.ingresos.total_cobrado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="balance-item">
                  <div class="balance-item-label">Egresos Totales</div>
                  <div class="balance-item-valor">$${datosReporte.egresos.total_egresos.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="balance-item" style="background: rgba(255,255,255,0.2);">
                  <div class="balance-item-label">⭐ Utilidad Neta</div>
                  <div class="balance-item-valor">$${datosReporte.balance.utilidad_neta.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div>
                  <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">
                    Margen: ${datosReporte.balance.margen_utilidad.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px; text-align: center;">DESGLOSE DE EGRESOS</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: center;">
                  <div>
                    <div style="font-size: 11px; opacity: 0.8;">Mantenimientos</div>
                    <div style="font-size: 18px; font-weight: bold; margin-top: 3px;">
                      $${datosReporte.egresos.mantenimientos.total.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                    </div>
                    <div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">
                      ${datosReporte.egresos.total_egresos > 0 
                        ? ((datosReporte.egresos.mantenimientos.total / datosReporte.egresos.total_egresos) * 100).toFixed(1)
                        : 0}% del total
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 11px; opacity: 0.8;">Servicios Condonados</div>
                    <div style="font-size: 18px; font-weight: bold; margin-top: 3px;">
                      $${datosReporte.egresos.servicios.total_condonado.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                    </div>
                    <div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">
                      ${datosReporte.egresos.total_egresos > 0 
                        ? ((datosReporte.egresos.servicios.total_condonado / datosReporte.egresos.total_egresos) * 100).toFixed(1)
                        : 0}% del total
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="footer">
              <p><strong>Reporte Financiero Global</strong></p>
              <p>Generado el ${new Date().toLocaleDateString('es-MX', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} a las ${new Date().toLocaleTimeString('es-MX')}</p>
              <p style="margin-top: 5px;">Sistema de Gestión de Propiedades</p>
            </div>
          </div>
        </body>
      </html>
    `;

    ventanaImpresion.document.write(html);
    ventanaImpresion.document.close();
    
    setTimeout(() => {
      ventanaImpresion.print();
    }, 250);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-4xl font-bold mb-2">📊 Reporte Financiero Global</h1>
        <p className="text-blue-100 text-lg">
          Análisis completo: Ingresos por Rentas + Egresos (Mantenimientos + Servicios) = Ganancia Real
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Seleccionar Periodo de Análisis</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Periodo Inicio *
            </label>
            <input
              type="month"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Periodo Fin *
            </label>
            <input
              type="month"
              value={periodoFin}
              onChange={(e) => setPeriodoFin(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={generarReporte}
          disabled={loading || !periodoInicio || !periodoFin}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-md transition-all"
        >
          {loading ? '⏳ Generando Reporte...' : '🔍 Generar Reporte Financiero'}
        </button>
      </div>

      {/* Vista Previa */}
      {datosReporte && !loading && (
        <div className="space-y-6">
          {/* Cards Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <p className="text-green-100 text-sm font-medium uppercase mb-2">💰 Ingresos Totales</p>
              <p className="text-4xl font-bold">
                ${datosReporte.ingresos.total_cobrado.toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </p>
              <p className="text-green-100 text-sm mt-2">
                Esperado: ${datosReporte.ingresos.total_esperado.toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </p>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
              <p className="text-red-100 text-sm font-medium uppercase mb-2">💸 Egresos Totales</p>
              <p className="text-4xl font-bold">
                ${datosReporte.egresos.total_egresos.toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </p>
              <p className="text-red-100 text-sm mt-2">
                Mant: ${datosReporte.egresos.mantenimientos.total.toLocaleString()} + 
                Serv: ${datosReporte.egresos.servicios.total_condonado.toLocaleString()}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <p className="text-blue-100 text-sm font-medium uppercase mb-2">📈 Utilidad Neta</p>
              <p className="text-4xl font-bold">
                ${datosReporte.balance.utilidad_neta.toLocaleString('es-MX', {minimumFractionDigits: 2})}
              </p>
              <p className="text-blue-100 text-sm mt-2">
                Margen: {datosReporte.balance.margen_utilidad.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Botón Imprimir */}
          <div className="flex justify-center">
            <button
              onClick={imprimirReporte}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg text-lg flex items-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              🖨️ Imprimir Reporte Completo
            </button>
          </div>

          {/* Mensaje Informativo */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Reporte Completo:</strong> Este análisis incluye todos los ingresos cobrados por rentas, 
                  menos todos los gastos de mantenimientos y servicios condonados (agua y luz que pagamos nosotros). 
                  La <strong>Utilidad Neta</strong> muestra tus ganancias reales del periodo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Generando reporte financiero...</p>
        </div>
      )}
    </div>
  );
};

export default ReporteFinancieroGlobal;