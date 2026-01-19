import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ModalEditarPago = ({ pago, onCerrar, onExito }) => {
  const [loading, setLoading] = useState(false);
  const [confirmandoEliminacion, setConfirmandoEliminacion] = useState(false);
  const [depositoDisponible, setDepositoDisponible] = useState(0);
  const [rentaBaseContrato, setRentaBaseContrato] = useState(0);
  // 1. Inicializamos el formData con valores por defecto
  const [formData, setFormData] = useState({
    monto_pagado: 0,
    medio_pago: 'transferencia',
    fecha_pago_realizado: '',
    agua_lectura: 0,
    luz_lectura: 0,
    limite_agua_aplicado: 250,
    limite_luz_aplicado: 250,
    cobrar_excedentes_de: 'renta'
  });

  // 2. EFECTO DE PRECARGA: Mapea los datos del pago al formulario al abrir
  useEffect(() => {
    if (pago) {
      console.log("📦 Precargando datos del pago:", pago);
      
      // Manejo de fecha: Convertir de Timestamp o String a formato YYYY-MM-DD para el input
      let fechaFormateada = "";
      if (pago.fecha_pago_realizado) {
        const dateObj = pago.fecha_pago_realizado.toDate 
          ? pago.fecha_pago_realizado.toDate() 
          : new Date(pago.fecha_pago_realizado);
        fechaFormateada = dateObj.toISOString().split('T')[0];
      }

      setFormData({
        monto_pagado: pago.monto_pagado || 0,
        medio_pago: pago.medio_pago || 'transferencia',
        fecha_pago_realizado: fechaFormateada,
        agua_lectura: pago.servicios?.agua_lectura || 0,
        luz_lectura: pago.servicios?.luz_lectura || 0,
        limite_agua_aplicado: pago.servicios?.limite_agua_aplicado || 250,
        limite_luz_aplicado: pago.servicios?.limite_luz_aplicado || 250,
        cobrar_excedentes_de: pago.servicios?.excedentes_cobrados_de || 'renta'
      });
    }
  }, [pago]);

  // 3. Obtener datos del contrato (Depósito y Renta Base)
  useEffect(() => {
    const obtenerDatosContrato = async () => {
      if (!pago?.id_contrato) return;
      
      try {
        const contratoRef = doc(db, "contratos", pago.id_contrato);
        const contratoSnap = await getDoc(contratoRef);
        
        if (contratoSnap.exists()) {
          const contratoData = contratoSnap.data();
          setDepositoDisponible(Number(contratoData.monto_deposito || 0));
          setRentaBaseContrato(Number(contratoData.monto_renta || 0));
        }
      } catch (error) {
        console.error("❌ Error al cargar contrato:", error);
      }
    };
    obtenerDatosContrato();
  }, [pago?.id_contrato]);
useEffect(() => {
  const obtenerDatosContrato = async () => {
    // 1. Diagnóstico: ¿Qué ID estamos recibiendo del objeto pago?
    console.log("🔍 Intentando buscar contrato con ID:", pago?.id_contrato);

    if (!pago?.id_contrato || pago.id_contrato === "sin_contrato") {
      console.error("❌ El pago no tiene un ID de contrato válido para consultar.");
      return;
    }
    
    try {
      const contratoRef = doc(db, "contratos", pago.id_contrato);
      const contratoSnap = await getDoc(contratoRef);
      
      if (contratoSnap.exists()) {
        const contratoData = contratoSnap.data();
        console.log("✅ Contrato Encontrado! Datos:", contratoData);
        
        // Seteamos los valores asegurándonos que sean números
        setDepositoDisponible(Number(contratoData.monto_deposito || 0));
        setRentaBaseContrato(Number(contratoData.monto_renta || 0));
      } else {
        // Si entra aquí, el ID que tiene el pago NO COINCIDE con el nombre del doc en Firebase
        console.error(`❌ No existe ningún documento en la colección 'contratos' cuyo ID sea exactamente: "${pago.id_contrato}"`);
        
        // Posible solución: Si el ID está mal, a veces se guarda el ID del inquilino por error
        console.log("💡 Tip: Revisa si el ID del documento en Firestore es igual al que imprimí arriba.");
      }
    } catch (error) {
      console.error("❌ Error crítico en la consulta a Firestore:", error);
    }
  };

  obtenerDatosContrato();
}, [pago]);

  useEffect(() => {
    const obtenerDeposito = async () => {
      if (!pago?.id_contrato || pago.id_contrato === "sin_contrato") return;
      
      try {
        const contratoRef = doc(db, "contratos", pago.id_contrato);
        const contratoSnap = await getDoc(contratoRef);
        
        if (contratoSnap.exists()) {
          const contratoData = contratoSnap.data();
          setDepositoDisponible(Number(contratoData.monto_deposito || 0));
        }
      } catch (error) {
        console.error("Error obteniendo depósito:", error);
      }
    };
    obtenerDeposito();
  }, [pago]);

  const excedentesActuales = useMemo(() => {
    const excAgua = Math.max(0, formData.agua_lectura - formData.limite_agua_aplicado);
    const excLuz = Math.max(0, formData.luz_lectura - formData.limite_luz_aplicado);
    return { excAgua, excLuz, total: excAgua + excLuz };
  }, [formData.agua_lectura, formData.luz_lectura, formData.limite_agua_aplicado, formData.limite_luz_aplicado]);

  // ⭐ NUEVA: Actualizar periodo en contrato
  const actualizarPeriodoEnContrato = async (nuevosValores) => {
    if (!pago.id_contrato || pago.id_contrato === "sin_contrato") return;

    try {
      const contratoRef = doc(db, "contratos", pago.id_contrato);
      const contratoSnap = await getDoc(contratoRef);
      
      if (!contratoSnap.exists()) return;
      
      const contrato = contratoSnap.data();
      const periodosEsperados = contrato.periodos_esperados || [];
      const indicePeriodo = periodosEsperados.findIndex(p => p.periodo === pago.periodo);
      
      if (indicePeriodo === -1) {
        console.warn(`Periodo ${pago.periodo} no existe en el contrato`);
        return;
      }
      
      // Actualizar el periodo con los nuevos valores
      periodosEsperados[indicePeriodo] = {
        ...periodosEsperados[indicePeriodo],
        ...nuevosValores,
        fecha_ultimo_pago: Timestamp.now()
      };
      
      // Contar periodos pagados
      const periodosPagados = periodosEsperados.filter(
        p => p.estatus === "pagado" || p.estatus === "condonado"
      ).length;
      
      await updateDoc(contratoRef, {
        periodos_esperados: periodosEsperados,
        periodos_pagados: periodosPagados
      });
      
      console.log(`✅ Periodo ${pago.periodo} actualizado en contrato`);
    } catch (error) {
      console.error("Error actualizando periodo en contrato:", error);
    }
  };

  // ⭐ NUEVA: Eliminar periodo del contrato (volver a pendiente)
  const revertirPeriodoEnContrato = async () => {
    if (!pago.id_contrato || pago.id_contrato === "sin_contrato") return;

    try {
      const contratoRef = doc(db, "contratos", pago.id_contrato);
      const contratoSnap = await getDoc(contratoRef);
      
      if (!contratoSnap.exists()) return;
      
      const contrato = contratoSnap.data();
      const periodosEsperados = contrato.periodos_esperados || [];
      const indicePeriodo = periodosEsperados.findIndex(p => p.periodo === pago.periodo);
      
      if (indicePeriodo === -1) return;
      
      // Volver el periodo a su estado original (pendiente)
      const periodoOriginal = periodosEsperados[indicePeriodo];
      periodosEsperados[indicePeriodo] = {
        periodo: periodoOriginal.periodo,
        anio: periodoOriginal.anio,
        mes: periodoOriginal.mes,
        estatus: "pendiente",
        monto_esperado: periodoOriginal.monto_esperado,
        monto_pagado: 0,
        saldo_restante: periodoOriginal.monto_esperado,
        fecha_ultimo_pago: null,
        id_pagos: []
      };
      
      const periodosPagados = periodosEsperados.filter(
        p => p.estatus === "pagado" || p.estatus === "condonado"
      ).length;
      
      await updateDoc(contratoRef, {
        periodos_esperados: periodosEsperados,
        periodos_pagados: periodosPagados
      });
      
      console.log(`✅ Periodo ${pago.periodo} revertido a pendiente`);
    } catch (error) {
      console.error("Error revirtiendo periodo:", error);
    }
  };

  const devolverExcedentesAlDeposito = async (monto) => {
    if (monto <= 0 || !pago.id_contrato || pago.id_contrato === "sin_contrato") return;

    try {
      const contratoRef = doc(db, "contratos", pago.id_contrato);
      const contratoSnap = await getDoc(contratoRef);
      
      if (contratoSnap.exists()) {
        const contratoData = contratoSnap.data();
        const depositoActual = Number(contratoData.monto_deposito || 0);
        const nuevoDeposito = depositoActual + monto;

        await updateDoc(contratoRef, {
          monto_deposito: nuevoDeposito
        });

        console.log(`✅ Depósito restaurado: $${depositoActual} + $${monto} = $${nuevoDeposito}`);
      }
    } catch (error) {
      console.error("Error devolviendo excedentes:", error);
      throw new Error("No se pudo devolver el depósito: " + error.message);
    }
  };

  const cobrarExcedentesDelDeposito = async (monto) => {
    if (monto <= 0 || !pago.id_contrato || pago.id_contrato === "sin_contrato") return;

    try {
      const contratoRef = doc(db, "contratos", pago.id_contrato);
      const contratoSnap = await getDoc(contratoRef);
      
      if (contratoSnap.exists()) {
        const contratoData = contratoSnap.data();
        const depositoActual = Number(contratoData.monto_deposito || 0);

        if (depositoActual < monto) {
          throw new Error(`Depósito insuficiente. Disponible: $${depositoActual}, Necesario: $${monto}`);
        }

        const nuevoDeposito = depositoActual - monto;

        await updateDoc(contratoRef, {
          monto_deposito: nuevoDeposito
        });

        console.log(`✅ Depósito actualizado: $${depositoActual} - $${monto} = $${nuevoDeposito}`);
      }
    } catch (error) {
      console.error("Error cobrando del depósito:", error);
      throw error;
    }
  };

  const handleEliminar = async () => {
    if (!confirmandoEliminacion) {
      setConfirmandoEliminacion(true);
      return;
    }

    setLoading(true);
    try {
      // 1. Devolver excedentes al depósito
      if (pago.servicios?.excedentes_cobrados_de === "deposito" && pago.servicios?.excedentes_del_deposito > 0) {
        await devolverExcedentesAlDeposito(pago.servicios.excedentes_del_deposito);
      }

      // 2. ⭐ Revertir periodo en contrato a "pendiente"
      await revertirPeriodoEnContrato();

      // 3. Eliminar el pago de Firestore
      const pagoRef = doc(db, "pagos", pago.id);
      await deleteDoc(pagoRef);

      alert("✅ Pago eliminado y periodo revertido a pendiente" + 
        (pago.servicios?.excedentes_del_deposito > 0 
          ? `. Se devolvieron $${pago.servicios.excedentes_del_deposito} al depósito` 
          : ""));
      
      onExito();
    } catch (error) {
      alert("❌ Error al eliminar: " + error.message);
    } finally {
      setLoading(false);
      setConfirmandoEliminacion(false);
    }
  };
const handleGuardar = async () => {
    if (formData.monto_pagado <= 0) {
      alert("⚠️ El monto debe ser mayor a 0");
      return;
    }

    // Calculamos el depósito real sumando lo que este pago ya tiene "apartado"
    const depositoRealActual = depositoDisponible + (pago.servicios?.excedentes_del_deposito || 0);

    if (formData.cobrar_excedentes_de === "deposito" && excedentesActuales.total > 0) {
      if (depositoRealActual < excedentesActuales.total) {
        alert(`⚠️ Depósito insuficiente. Disponible: $${depositoRealActual}, Necesario: $${excedentesActuales.total}`);
        return;
      }
    }

    setLoading(true);

    try {
      const opcionOriginal = pago.servicios?.excedentes_cobrados_de || 'renta';
      const excedentesOriginalesEnDeposito = Number(pago.servicios?.excedentes_del_deposito || 0);
      const opcionNueva = formData.cobrar_excedentes_de;

      // 1. Devolver excedentes originales al contrato si estaban en depósito
      if (opcionOriginal === "deposito" && excedentesOriginalesEnDeposito > 0) {
        await devolverExcedentesAlDeposito(excedentesOriginalesEnDeposito);
      }

      // 2. Cobrar nuevos excedentes del depósito si aplica
      let nuevoExcedentesDelDeposito = 0;
      if (opcionNueva === "deposito" && excedentesActuales.total > 0) {
        await cobrarExcedentesDelDeposito(excedentesActuales.total);
        nuevoExcedentesDelDeposito = excedentesActuales.total;
      }

      // 3. CALCULAR EL NUEVO TOTAL ESPERADO (Correctamente)
      // Usamos la renta base del contrato para que sea el punto de partida limpio
      const nuevoTotalEsperado = opcionNueva === "deposito" 
        ? rentaBaseContrato 
        : rentaBaseContrato + excedentesActuales.total;

      const nuevoSaldoRestante = Math.max(0, nuevoTotalEsperado - formData.monto_pagado);
      const nuevoEstatus = nuevoSaldoRestante <= 0 ? "pagado" : "parcial";

      // 4. Actualizar documento de pago
      const pagoRef = doc(db, "pagos", pago.id);
      await updateDoc(pagoRef, {
        monto_pagado: formData.monto_pagado,
        medio_pago: formData.medio_pago,
        fecha_pago_realizado: formData.fecha_pago_realizado,
        total_esperado_periodo: nuevoTotalEsperado,
        saldo_restante_periodo: nuevoSaldoRestante,
        estatus: nuevoEstatus,
        servicios: {
          agua_lectura: formData.agua_lectura,
          luz_lectura: formData.luz_lectura,
          limite_agua_aplicado: formData.limite_agua_aplicado,
          limite_luz_aplicado: formData.limite_luz_aplicado,
          excedentes_cobrados_de: opcionNueva,
          excedentes_del_deposito: nuevoExcedentesDelDeposito
        },
        fecha_ultima_modificacion: new Date()
      });

      // 5. Actualizar periodo en contrato con los NUEVOS valores calculados
      await actualizarPeriodoEnContrato({
        monto_pagado: formData.monto_pagado,
        saldo_restante: nuevoSaldoRestante,
        estatus: nuevoEstatus,
        monto_esperado: nuevoTotalEsperado // Para que el historial y Dashboard cuadren
      });

      alert("✅ Pago y periodo actualizados correctamente");
      onExito();
    } catch (error) {
      console.error(error);
      alert("❌ Error al actualizar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!pago) return null;

  const depositoDisponibleConDevolucion = depositoDisponible + (pago.servicios?.excedentes_del_deposito || 0);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
        
        {/* Cabecera mejorada para la secretaria */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg text-2xl">📝</div>
            <div>
              <h2 className="text-white font-black text-lg leading-tight uppercase tracking-tight">Modificar Registro</h2>
              <p className="text-blue-100 text-[10px] font-bold uppercase opacity-80">
                Folio Pago: {pago?.id?.substring(0,8)}... | Periodo: {pago?.periodo}
              </p>
            </div>
          </div>
          <button onClick={onCerrar} className="text-white hover:rotate-90 transition-transform p-1">
            <span className="text-3xl font-light">×</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Banner informativo de abono */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
            <p className="text-blue-800 text-[11px] font-bold">
              ℹ️ Estás editando un <span className="underline">Abono Específico</span>. Si cambias el monto, el saldo restante del mes se recalculará automáticamente.
            </p>
          </div>

          {/* GRID DE DATOS PRINCIPALES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-xl border-2 border-green-100 focus-within:border-green-400 transition-all">
              <label className="text-[10px] font-black text-green-700 uppercase block mb-1">Monto de este Abono</label>
              <div className="flex items-center">
                <span className="text-2xl font-black text-green-600 mr-2">$</span>
                <input 
                  type="number"
                  value={formData.monto_pagado}
                  onChange={(e) => setFormData({...formData, monto_pagado: Number(e.target.value)})}
                  className="w-full text-2xl font-black text-green-800 bg-transparent outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-100 focus-within:border-blue-400 transition-all">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Medio de Pago</label>
              <select
                value={formData.medio_pago}
                onChange={(e) => setFormData({...formData, medio_pago: e.target.value})}
                className="w-full text-lg font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
              >
                <option value="transferencia">🏦 Transferencia</option>
                <option value="efectivo">💵 Efectivo</option>
                <option value="deposito">📑 Depósito Bancario</option>
              </select>
            </div>
          </div>

          {/* SECCIÓN DE SERVICIOS */}
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-4">Control de Lecturas y Excedentes</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                   <label className="text-[10px] font-bold text-cyan-700 uppercase">💧 Lectura Agua</label>
                   <span className="text-[9px] bg-cyan-100 text-cyan-700 px-1.5 rounded font-bold">Límite: ${formData.limite_agua_aplicado}</span>
                </div>
                <input 
                  type="number"
                  value={formData.agua_lectura}
                  onChange={(e) => setFormData({...formData, agua_lectura: Number(e.target.value)})}
                  className="w-full p-3 text-xl font-black text-center bg-cyan-50 rounded-xl border-2 border-cyan-200 focus:border-cyan-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                   <label className="text-[10px] font-bold text-yellow-700 uppercase">⚡ Lectura Luz</label>
                   <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 rounded font-bold">Límite: ${formData.limite_luz_aplicado}</span>
                </div>
                <input 
                  type="number"
                  value={formData.luz_lectura}
                  onChange={(e) => setFormData({...formData, luz_lectura: Number(e.target.value)})}
                  className="w-full p-3 text-xl font-black text-center bg-yellow-50 rounded-xl border-2 border-yellow-200 focus:border-yellow-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* ... Resto de los botones y lógica de excedentes que ya tienes ... */}
          {/* (Solo asegúrate de usar handleGuardar y handleEliminar) */}
          
          <div className="flex gap-4 pt-4">
             <button
                onClick={handleGuardar}
                disabled={loading}
                className="flex-[2] bg-indigo-600 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
             >
                {loading ? 'Procesando...' : '💾 Actualizar Todo'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalEditarPago;