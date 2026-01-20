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
    const contratoRef = doc(db, "contratos", pago.id_contrato);
    const contratoSnap = await getDoc(contratoRef);
    
    if (!contratoSnap.exists()) throw new Error("No se encontró el contrato");
    
    const datosContrato = contratoSnap.data();
    const depositoActual = Number(datosContrato.monto_deposito || 0);
    const rentaBase = Number(datosContrato.monto_renta || 0);

    // 1. REVERSIÓN DEL DEPÓSITO
    // Si este pago cobró excedentes del depósito, hay que devolverlos
    let montoADevolver = 0;
    if (pago.servicios?.excedentes_cobrados_de === "deposito") {
      montoADevolver = Number(pago.servicios?.excedentes_del_deposito || 0);
    }

    // 2. RESETEAR EL PERIODO EN EL CONTRATO
    const periodosActualizados = datosContrato.periodos_esperados.map((p) => {
      if (p.periodo === pago.periodo) {
        return {
          ...p,
          estatus: "pendiente",
          monto_pagado: 0,
          monto_esperado: rentaBase, // Volver a la renta sin excedentes
          saldo_restante: rentaBase,
          fecha_ultimo_pago: null,
          id_pagos: [] // Limpiar los IDs de pago asociados
        };
      }
      return p;
    });

    // 3. ACTUALIZAR CONTRATO (Monto depósito devuelto)
    await updateDoc(contratoRef, {
      monto_deposito: depositoActual + montoADevolver,
      periodos_esperados: periodosActualizados,
      periodos_pagados: periodosActualizados.filter(p => p.estatus === "pagado").length
    });

    // 4. ELIMINAR EL PAGO
    await deleteDoc(doc(db, "pagos", pago.id));

    alert(`✅ Pago eliminado. Se devolvieron $${montoADevolver} al depósito.`);
    onExito();
  } catch (error) {
    alert("❌ Error al eliminar: " + error.message);
  } finally {
    setLoading(false);
  }
};
const handleGuardar = async () => {
  if (formData.monto_pagado <= 0) {
    alert("⚠️ El monto debe ser mayor a 0");
    return;
  }

  setLoading(true);

  try {
    // 1. LEER EL CONTRATO Y EL PAGO DIRECTAMENTE DE FIRESTORE
    const contratoRef = doc(db, "contratos", pago.id_contrato);
    const pagoRef = doc(db, "pagos", pago.id);

    const [contratoSnap, pagoSnap] = await Promise.all([
      getDoc(contratoRef),
      getDoc(pagoRef)
    ]);

    if (!contratoSnap.exists() || !pagoSnap.exists()) throw new Error("No se encontraron los documentos");

    const datosContrato = contratoSnap.data();
    const datosPagoActual = pagoSnap.data(); // <--- Aquí está la verdad

    // 2. EXTRAER VALORES REALES
    const depositoEnDB = Number(datosContrato.monto_deposito || 0);
    const rentaBase = Number(datosContrato.monto_renta || 0);
    
    // Lo que realmente se descontó del depósito en la transacción anterior
    const descontadoAnteriormente = Number(datosPagoActual.servicios?.excedentes_del_deposito || 0);

    // 3. RESTAURAR DEPÓSITO (Paso clave)
    // Devolvemos lo que sea que diga el documento de pago que se cobró
    const depositoRestaurado = depositoEnDB + descontadoAnteriormente;

    // 4. NUEVO CÁLCULO BASADO EN EL FORMULARIO
    const nuevoExcedenteTotal = excedentesActuales.total;
    const esCobroDelDeposito = formData.cobrar_excedentes_de === 'deposito';

    let montoFinalDeposito = depositoRestaurado;
    let nuevoDescuentoAlDeposito = 0;

    if (esCobroDelDeposito) {
      if (depositoRestaurado < nuevoExcedenteTotal) {
        throw new Error(`Fondos insuficientes. El depósito restaurado es $${depositoRestaurado}`);
      }
      montoFinalDeposito = depositoRestaurado - nuevoExcedenteTotal;
      nuevoDescuentoAlDeposito = nuevoExcedenteTotal;
    }

    const nuevoTotalEsperado = esCobroDelDeposito ? rentaBase : rentaBase + nuevoExcedenteTotal;
    const nuevoSaldoRestante = Math.max(0, nuevoTotalEsperado - formData.monto_pagado);
    const nuevoEstatus = nuevoSaldoRestante <= 0 ? "pagado" : "parcial";

    // 5. ACTUALIZAR TODO
    const periodosActualizados = datosContrato.periodos_esperados.map((p) => {
      if (p.periodo === pago.periodo) {
        return { ...p, monto_pagado: formData.monto_pagado, monto_esperado: nuevoTotalEsperado, saldo_restante: nuevoSaldoRestante, estatus: nuevoEstatus, fecha_ultimo_pago: Timestamp.now() };
      }
      return p;
    });

    await updateDoc(contratoRef, {
      monto_deposito: montoFinalDeposito,
      periodos_esperados: periodosActualizados
    });

    await updateDoc(pagoRef, {
      monto_pagado: formData.monto_pagado,
      total_esperado_periodo: nuevoTotalEsperado,
      saldo_restante_periodo: nuevoSaldoRestante,
      estatus: nuevoEstatus,
      servicios: {
        ...datosPagoActual.servicios,
        agua_lectura: formData.agua_lectura,
        luz_lectura: formData.luz_lectura,
        excedentes_cobrados_de: formData.cobrar_excedentes_de,
        excedentes_del_deposito: nuevoDescuentoAlDeposito // <--- Esto es lo que leeremos en la próxima edición
      }
    });

    alert("✅ Cambios guardados y depósito conciliado.");
    onExito();
  } catch (error) {
    alert(error.message);
  } finally {
    setLoading(false);
  }
};
  if (!pago) return null;

  const depositoDisponibleConDevolucion = depositoDisponible + (pago.servicios?.excedentes_del_deposito || 0);
return (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
      
      {/* Cabecera Informativa */}
      <div className="bg-indigo-700 p-5 rounded-t-2xl flex justify-between items-center sticky top-0 z-20">
        <div>
          <h2 className="text-white font-black uppercase tracking-tight text-sm">Editar Registro de Pago</h2>
          <p className="text-indigo-200 text-[10px] font-bold uppercase">{pago.nombre_inquilino} • {pago.id_unidad}</p>
        </div>
        <button onClick={onCerrar} className="text-white text-2xl hover:scale-110 transition-transform">×</button>
      </div>

      <div className="p-6 space-y-6">
        
        {/* LECTURAS DE SERVICIOS */}
        <div className="grid grid-cols-2 gap-4">
           <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">💧 Lectura Agua</label>
              <input type="number" value={formData.agua_lectura} 
                onChange={e => setFormData({...formData, agua_lectura: Number(e.target.value)})}
                className="w-full p-3 bg-cyan-50 border-2 border-cyan-100 rounded-xl font-bold" />
           </div>
           <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">⚡ Lectura Luz</label>
              <input type="number" value={formData.luz_lectura} 
                onChange={e => setFormData({...formData, luz_lectura: Number(e.target.value)})}
                className="w-full p-3 bg-yellow-50 border-2 border-yellow-100 rounded-xl font-bold" />
           </div>
        </div>

        {/* SELECTOR DE ORIGEN DE COBRO */}
        <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
          <h3 className="text-[10px] font-black text-slate-400 uppercase mb-3 text-center italic">
            Configuración de Excedentes (${excedentesActuales.total})
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setFormData({...formData, cobrar_excedentes_de: 'renta'})}
              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center ${formData.cobrar_excedentes_de === 'renta' ? 'border-indigo-500 bg-indigo-50' : 'border-white bg-white'}`}
            >
              <span className="text-lg">🏢</span>
              <span className="text-[10px] font-black uppercase">Sumar a Renta</span>
              <span className="text-[11px] font-bold text-indigo-600">${rentaBaseContrato + excedentesActuales.total}</span>
            </button>

            <button 
              onClick={() => setFormData({...formData, cobrar_excedentes_de: 'deposito'})}
              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center ${formData.cobrar_excedentes_de === 'deposito' ? 'border-orange-500 bg-orange-50' : 'border-white bg-white'}`}
            >
              <span className="text-lg">💰</span>
              <span className="text-[10px] font-black uppercase">Del Depósito</span>
              <span className="text-[11px] font-bold text-orange-600">Disp: ${depositoDisponible}</span>
            </button>
          </div>
        </div>

        {/* MONTO PAGADO */}
        <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
          <label className="text-[10px] font-black text-green-700 uppercase block mb-1">Total recibido por la administración:</label>
          <input type="number" value={formData.monto_pagado} 
            onChange={e => setFormData({...formData, monto_pagado: Number(e.target.value)})}
            className="w-full text-2xl font-black text-green-800 bg-transparent outline-none" />
        </div>

        {/* ACCIONES FINALIZAR / ELIMINAR */}
        <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={handleGuardar}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : '💾 Guardar y Actualizar Depósito'}
          </button>

          <button
            onClick={handleEliminar}
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-[10px] uppercase border transition-all ${
              confirmandoEliminacion ? 'bg-red-600 text-white border-red-600 shadow-lg' : 'bg-white text-red-500 border-red-100 hover:bg-red-50'
            }`}
          >
            {confirmandoEliminacion ? '⚠️ Confirmar: Restaurar depósito y borrar pago' : '🗑️ Eliminar este pago'}
          </button>
        </div>
        
        <p className="text-[9px] text-gray-400 text-center font-bold uppercase tracking-tighter">
          Al guardar, el sistema restaurará primero el depósito previo y aplicará el nuevo cálculo automáticamente.
        </p>

      </div>
    </div>
  </div>
);
};

export default ModalEditarPago;