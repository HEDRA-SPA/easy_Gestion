import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, deleteDoc, getDoc, getDocs, query, collection, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

// Recibimos 'esPrimerPago' desde el componente padre (HistorialPagos)
const ModalEditarPago = ({ pago, esPrimerPago, onCerrar, onExito }) => {
  const [loading, setLoading] = useState(false);
  const [confirmandoEliminacion, setConfirmandoEliminacion] = useState(false);
  const [depositoDisponible, setDepositoDisponible] = useState(0);
  const [rentaBaseContrato, setRentaBaseContrato] = useState(0);
  const [datosPagoReal, setDatosPagoReal] = useState(null);
  
  const [formData, setFormData] = useState({
    monto_pagado: 0,
    medio_pago: 'transferencia',
    fecha_pago_realizado: '',
    agua_lectura: 0,
    luz_lectura: 0,
    internet_lectura: 0,
    limite_agua_aplicado: 250,
    limite_luz_aplicado: 250,
    limite_internet_aplicado: 250,
    cobrar_excedentes_de: 'renta'
  });

  // 1. Cargar datos iniciales
  useEffect(() => {
    const cargarDatos = async () => {
      if (!pago?.id) return;
      try {
        const pagoRef = doc(db, "pagos", pago.id);
        const pagoSnap = await getDoc(pagoRef);
        
        if (!pagoSnap.exists()) return onCerrar();
        
        const datos = pagoSnap.data();
        setDatosPagoReal(datos);

        // Formatear fecha para el input type="date"
        let f = "";
        if (datos.fecha_pago_realizado) {
          const d = datos.fecha_pago_realizado.toDate ? datos.fecha_pago_realizado.toDate() : new Date(datos.fecha_pago_realizado);
          f = d.toISOString().split('T')[0];
        }

        setFormData({
          monto_pagado: Number(datos.monto_pagado || 0),
          medio_pago: datos.medio_pago || 'transferencia',
          fecha_pago_realizado: f,
          agua_lectura: Number(datos.servicios?.agua_lectura || 0),
          luz_lectura: Number(datos.servicios?.luz_lectura || 0),
          internet_lectura: Number(datos.servicios?.internet_lectura || 0),
          limite_agua_aplicado: Number(datos.servicios?.limite_agua_aplicado || 250),
          limite_luz_aplicado: Number(datos.servicios?.limite_luz_aplicado || 250),
          limite_internet_aplicado: Number(datos.servicios?.limite_internet_aplicado || 250),
          cobrar_excedentes_de: datos.servicios?.excedentes_cobrados_de || 'renta'
        });

        // Cargar Contrato para límites y depósitos
        const contratoRef = doc(db, "contratos", pago.id_contrato);
        const contratoSnap = await getDoc(contratoRef);
        if (contratoSnap.exists()) {
          setDepositoDisponible(Number(contratoSnap.data().monto_deposito || 0));
          setRentaBaseContrato(Number(contratoSnap.data().monto_renta || 0));
        }
      } catch (e) { console.error(e); }
    };
    cargarDatos();
  }, [pago?.id]);

  const excedentes = useMemo(() => {
    const a = Math.max(0, formData.agua_lectura - formData.limite_agua_aplicado);
    const l = Math.max(0, formData.luz_lectura - formData.limite_luz_aplicado);
    const i = Math.max(0, formData.internet_lectura - formData.limite_internet_aplicado);
    return { agua: a, luz: l, internet: i, total: a + l + i };
  }, [formData.agua_lectura, formData.luz_lectura, formData.internet_lectura, formData.limite_agua_aplicado, formData.limite_luz_aplicado, formData.limite_internet_aplicado]);
const handleGuardar = async () => {
  if (formData.monto_pagado <= 0) return alert("Monto inválido");

  setLoading(true);
  try {
    const contratoRef = doc(db, "contratos", pago.id_contrato);
    const pagoRef = doc(db, "pagos", pago.id);
    
    // 1. Obtener datos frescos de TODO lo involucrado
    const [cSnap, pSnap] = await Promise.all([
      getDoc(contratoRef),
      getDocs(query(collection(db, "pagos"), where("id_contrato", "==", pago.id_contrato), where("periodo", "==", pago.periodo)))
    ]);

    const cData = cSnap.data();
    const todosLosPagosDocs = pSnap.docs;

    // 🔥 CRÍTICO: Obtener el monto_esperado ORIGINAL del periodo
    const periodoInfo = cData.periodos_esperados.find(p => p.periodo === pago.periodo);
    const montoEsperadoOriginal = periodoInfo?.monto_esperado || rentaBaseContrato;

    // 2. Calcular el nuevo escenario de servicios (Solo si es el primer pago)
    let nuevoTotalEsperado = montoEsperadoOriginal; // ✅ Usar el histórico
    let nuevoDescuentoDep = 0;
    let montoFinalDeposito = depositoDisponible;

    if (esPrimerPago) {
      // Restauramos depósito sumando lo que este pago específico tenía descontado antes
      const anteriorDescuento = Number(datosPagoReal.servicios?.excedentes_del_deposito || 0);
      const depRestaurado = depositoDisponible + anteriorDescuento;
      
      // 🔥 CALCULAR EXCEDENTES PREVIOS CORRECTAMENTE
      const aguaPrev = Math.max(0, (datosPagoReal.servicios?.agua_lectura || 0) - (datosPagoReal.servicios?.limite_agua_aplicado || 250));
      const luzPrev = Math.max(0, (datosPagoReal.servicios?.luz_lectura || 0) - (datosPagoReal.servicios?.limite_luz_aplicado || 250));
      const internetPrev = Math.max(0, (datosPagoReal.servicios?.internet_lectura || 0) - (datosPagoReal.servicios?.limite_internet_aplicado || 250));
      const excedentesPreviosTotal = aguaPrev + luzPrev + internetPrev;
      
      // Determinar la RENTA BASE SIN excedentes (el monto original que debería tener el periodo)
      let rentaBasePura = montoEsperadoOriginal;
      
      if (datosPagoReal.servicios?.excedentes_cobrados_de === 'renta') {
        // Si antes cobraba de renta, la base pura es el monto original MENOS los excedentes previos
        rentaBasePura = montoEsperadoOriginal - excedentesPreviosTotal;
      }
      // Si antes cobraba de depósito, la base pura YA es el montoEsperadoOriginal
      
      // AHORA aplicar la nueva configuración
      if (formData.cobrar_excedentes_de === 'deposito') {
        // Cobrar del depósito
        montoFinalDeposito = depRestaurado - excedentes.total;
        nuevoDescuentoDep = excedentes.total;
        nuevoTotalEsperado = rentaBasePura; // ✅ Solo la renta base, sin excedentes
      } else {
        // Cobrar de la renta
        montoFinalDeposito = depRestaurado; // ✅ Restaurar el depósito completo
        nuevoDescuentoDep = 0;
        nuevoTotalEsperado = rentaBasePura + excedentes.total; // ✅ Renta base + excedentes actuales
      }
    }

    // 3. CALCULO CRÍTICO: Sumar todos los abonos existentes reemplazando el que estamos editando
    const sumaOtrosAbonos = todosLosPagosDocs
      .filter(doc => doc.id !== pago.id)
      .reduce((acc, doc) => acc + Number(doc.data().monto_pagado || 0), 0);

    const nuevoTotalPagadoAcumulado = sumaOtrosAbonos + formData.monto_pagado;
    const nuevoSaldoGlobal = Math.max(0, nuevoTotalEsperado - nuevoTotalPagadoAcumulado);
    const nuevoEstatusGlobal = nuevoSaldoGlobal <= 0 ? "pagado" : "parcial";

    // 4. ACTUALIZACIÓN EN LOTE (Batch) para coherencia total
    // Actualizar Contrato
    const nuevosPeriodosArr = cData.periodos_esperados.map(p => {
      if (p.periodo === pago.periodo) {
        return {
          ...p,
          monto_pagado: nuevoTotalPagadoAcumulado,
          monto_esperado: nuevoTotalEsperado, // ✅ Este valor YA respeta el histórico
          saldo_restante: nuevoSaldoGlobal,
          estatus: nuevoEstatusGlobal
        };
      }
      return p;
    });

    await updateDoc(contratoRef, {
      monto_deposito: montoFinalDeposito,
      periodos_esperados: nuevosPeriodosArr,
      periodos_pagados: nuevosPeriodosArr.filter(p => p.estatus === "pagado").length
    });

    // 5. Sincronizar TODOS los documentos de pago de este periodo
    const promesasPagos = todosLosPagosDocs.map(pDoc => {
      const isEditingThisOne = pDoc.id === pago.id;
      const pagoData = pDoc.data();
      
      const updateData = {
        total_esperado_periodo: nuevoTotalEsperado,
        saldo_restante_periodo: nuevoSaldoGlobal,
        estatus: nuevoEstatusGlobal,
        fecha_ultima_modificacion: Timestamp.now()
      };

      // Si el pago tiene servicios, actualizar las lecturas
      if (esPrimerPago && pagoData.servicios) {
        updateData.servicios = {
          ...pagoData.servicios,
          agua_lectura: formData.agua_lectura,
          luz_lectura: formData.luz_lectura,
          internet_lectura: formData.internet_lectura,
          limite_agua_aplicado: formData.limite_agua_aplicado,
          limite_luz_aplicado: formData.limite_luz_aplicado,
          limite_internet_aplicado: formData.limite_internet_aplicado,
          excedentes_cobrados_de: formData.cobrar_excedentes_de,
          excedentes_del_deposito: isEditingThisOne ? nuevoDescuentoDep : 0
        };
      }

      // Si es el documento que el usuario está editando, actualizar su monto y medio
      if (isEditingThisOne) {
        updateData.monto_pagado = formData.monto_pagado;
        updateData.medio_pago = formData.medio_pago;
        updateData.fecha_pago_realizado = formData.fecha_pago_realizado;
      }

      return updateDoc(doc(db, "pagos", pDoc.id), updateData);
    });

    await Promise.all(promesasPagos);

    alert("✅ Coherencia restaurada en todos los abonos");
    onExito();
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
        
        {/* Header Dinámico */}
        <div className={`p-4 text-white flex justify-between ${esPrimerPago ? 'bg-indigo-600' : 'bg-slate-700'}`}>
          <div>
            <h2 className="font-black text-xs uppercase tracking-widest">
              {esPrimerPago ? '📝 Editar Pago Principal (Lecturas)' : '💰 Editar Abono Secundario'}
            </h2>
            <p className="text-[10px] opacity-80 font-bold">{pago.periodo}</p>
          </div>
          <button onClick={onCerrar} className="text-xl">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Fila: Monto y Medio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Monto del Abono</label>
              <input 
                type="number"
                value={formData.monto_pagado}
                onChange={(e) => setFormData({...formData, monto_pagado: Number(e.target.value)})}
                className="w-full text-xl font-black text-indigo-700 bg-transparent outline-none"
              />
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Medio</label>
              <select
                value={formData.medio_pago}
                onChange={(e) => setFormData({...formData, medio_pago: e.target.value})}
                className="w-full font-bold text-gray-700 bg-transparent outline-none"
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="deposito">Depósito</option>
              </select>
            </div>
          </div>

          {/* Sección de Lecturas: SOLO SI ES EL PRIMER PAGO */}
          {esPrimerPago ? (
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <label className="text-[9px] font-bold text-blue-500 uppercase">Lectura Agua</label>
                  <input 
                    type="number"
                    value={formData.agua_lectura}
                    onChange={(e) => setFormData({...formData, agua_lectura: Number(e.target.value)})}
                    className="w-full p-2 bg-blue-50 border border-blue-100 rounded font-bold"
                  />
                </div>
                <div className="relative">
                  <label className="text-[9px] font-bold text-yellow-600 uppercase">Lectura Luz</label>
                  <input 
                    type="number"
                    value={formData.luz_lectura}
                    onChange={(e) => setFormData({...formData, luz_lectura: Number(e.target.value)})}
                    className="w-full p-2 bg-yellow-50 border border-yellow-100 rounded font-bold"
                  />
                </div>
                <div className="relative">
                  <label className="text-[9px] font-bold text-purple-600 uppercase">Lectura Internet</label>
                  <input 
                    type="number"
                    value={formData.internet_lectura}
                    onChange={(e) => setFormData({...formData, internet_lectura: Number(e.target.value)})}
                    className="w-full p-2 bg-purple-50 border border-purple-100 rounded font-bold"
                  />
                </div>
              </div>

              {excedentes.total > 0 && (
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <p className="text-[10px] font-black text-purple-700 mb-2 text-center uppercase">Cobrar Excedentes (${excedentes.total}) de:</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setFormData({...formData, cobrar_excedentes_de: 'renta'})}
                      className={`flex-1 py-2 rounded text-xs font-bold border-2 transition ${formData.cobrar_excedentes_de === 'renta' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200'}`}
                    >🏢 Renta</button>
                    <button 
                      onClick={() => setFormData({...formData, cobrar_excedentes_de: 'deposito'})}
                      className={`flex-1 py-2 rounded text-xs font-bold border-2 transition ${formData.cobrar_excedentes_de === 'deposito' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-500 border-orange-200'}`}
                    >💰 Depósito</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
              <p className="text-[10px] text-amber-700 font-bold uppercase italic">
                ⚠️ Las lecturas solo pueden editarse en el pago principal del mes.
              </p>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex flex-col gap-2 pt-4">
            <button
              onClick={handleGuardar}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-200"
            >
              {loading ? 'Guardando...' : '💾 Actualizar Abono'}
            </button>
            <button
              onClick={onCerrar}
              className="w-full py-2 text-gray-400 font-bold text-xs uppercase"
            >Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalEditarPago;