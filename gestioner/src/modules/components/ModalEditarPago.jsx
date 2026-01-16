import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ModalEditarPago = ({ pago, onCerrar, onExito }) => {
  const [loading, setLoading] = useState(false);
  const [confirmandoEliminacion, setConfirmandoEliminacion] = useState(false);
  const [depositoDisponible, setDepositoDisponible] = useState(0);
  const [formData, setFormData] = useState({
    monto_pagado: 0,
    medio_pago: 'transferencia',
    fecha_pago_realizado: '',
    agua_lectura: 0,
    luz_lectura: 0,
    limite_agua_aplicado: 250,
    limite_luz_aplicado: 250,
    cobrar_excedentes_de: 'renta' // NUEVO: opción editable
  });

  useEffect(() => {
    if (pago) {
      // Convertir fecha de Firebase Timestamp a formato YYYY-MM-DD
      let fechaFormateada = '';
      if (pago.fecha_pago_realizado) {
        const fecha = pago.fecha_pago_realizado.toDate 
          ? pago.fecha_pago_realizado.toDate() 
          : new Date(pago.fecha_pago_realizado);
        fechaFormateada = fecha.toISOString().split('T')[0];
      }

      setFormData({
        monto_pagado: Number(pago.monto_pagado || 0),
        medio_pago: pago.medio_pago || 'transferencia',
        fecha_pago_realizado: fechaFormateada,
        agua_lectura: Number(pago.servicios?.agua_lectura || 0),
        luz_lectura: Number(pago.servicios?.luz_lectura || 0),
        limite_agua_aplicado: Number(pago.servicios?.limite_agua_aplicado || 250),
        limite_luz_aplicado: Number(pago.servicios?.limite_luz_aplicado || 250),
        cobrar_excedentes_de: pago.servicios?.excedentes_cobrados_de || 'renta'
      });
    }
  }, [pago]);

  // Obtener depósito disponible del contrato
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

  // Calcular excedentes actuales
  const excedentesActuales = useMemo(() => {
    const excAgua = Math.max(0, formData.agua_lectura - formData.limite_agua_aplicado);
    const excLuz = Math.max(0, formData.luz_lectura - formData.limite_luz_aplicado);
    return { excAgua, excLuz, total: excAgua + excLuz };
  }, [formData.agua_lectura, formData.luz_lectura, formData.limite_agua_aplicado, formData.limite_luz_aplicado]);

  // Función para devolver excedentes al depósito
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

  // Función para cobrar excedentes del depósito
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
      // Devolver excedentes al depósito SI fueron cobrados del depósito
      if (pago.servicios?.excedentes_cobrados_de === "deposito" && pago.servicios?.excedentes_del_deposito > 0) {
        await devolverExcedentesAlDeposito(pago.servicios.excedentes_del_deposito);
      }

      // Eliminar el pago de Firestore
      const pagoRef = doc(db, "pagos", pago.id);
      await deleteDoc(pagoRef);

      alert("✅ Pago eliminado correctamente" + 
        (pago.servicios?.excedentes_del_deposito > 0 
          ? ` y se devolvieron $${pago.servicios.excedentes_del_deposito} al depósito` 
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

    // Validar si hay suficiente depósito cuando se cambia a "deposito"
    if (formData.cobrar_excedentes_de === "deposito" && excedentesActuales.total > 0) {
      const depositoConExcedentesOriginales = depositoDisponible + (pago.servicios?.excedentes_del_deposito || 0);
      if (depositoConExcedentesOriginales < excedentesActuales.total) {
        alert(`⚠️ Depósito insuficiente. Disponible: $${depositoConExcedentesOriginales}, Necesario: $${excedentesActuales.total}`);
        return;
      }
    }

    setLoading(true);

    try {
      const opcionOriginal = pago.servicios?.excedentes_cobrados_de || 'renta';
      const excedentesOriginales = Number(pago.servicios?.excedentes_del_deposito || 0);
      const opcionNueva = formData.cobrar_excedentes_de;

      // 1️⃣ DEVOLVER excedentes originales del depósito (si había)
      if (opcionOriginal === "deposito" && excedentesOriginales > 0) {
        await devolverExcedentesAlDeposito(excedentesOriginales);
      }

      // 2️⃣ COBRAR nuevos excedentes del depósito (si se seleccionó)
      let nuevoExcedentesDelDeposito = 0;
      if (opcionNueva === "deposito" && excedentesActuales.total > 0) {
        await cobrarExcedentesDelDeposito(excedentesActuales.total);
        nuevoExcedentesDelDeposito = excedentesActuales.total;
      }

      // 3️⃣ Calcular nuevo total esperado
      // Primero obtener la renta base SIN excedentes
      const excedentesOriginalesCalculados = Math.max(0, (pago.servicios?.agua_lectura || 0) - (pago.servicios?.limite_agua_aplicado || 0)) +
                                              Math.max(0, (pago.servicios?.luz_lectura || 0) - (pago.servicios?.limite_luz_aplicado || 0));
      
      // Calcular renta base quitando TODOS los excedentes previos
      let rentaBase = Number(pago.total_esperado_periodo || 0);
      
      // Si originalmente fue cobrado de renta, quitamos esos excedentes
      if (opcionOriginal === "renta") {
        rentaBase = rentaBase - excedentesOriginalesCalculados;
      }
      // Si fue cobrado del depósito, el total_esperado ya era solo la renta base

      // Ahora aplicar la nueva opción
      const nuevoTotalEsperado = opcionNueva === "deposito" 
        ? rentaBase  // Solo renta, excedentes van al depósito
        : rentaBase + excedentesActuales.total; // Renta + excedentes

      const nuevoSaldoRestante = Math.max(0, nuevoTotalEsperado - formData.monto_pagado);
      const nuevoEstatus = nuevoSaldoRestante <= 0 ? "pagado" : "parcial";

      // 4️⃣ Actualizar el documento
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

      alert("✅ Pago actualizado correctamente");
      onExito();
    } catch (error) {
      alert("❌ Error al actualizar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!pago) return null;

  const depositoDisponibleConDevolucion = depositoDisponible + (pago.servicios?.excedentes_del_deposito || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-t-xl flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-white font-black text-xl">✏️ EDITAR PAGO</h2>
            <p className="text-blue-100 text-sm">Periodo: {pago.periodo}</p>
          </div>
          <button 
            onClick={onCerrar}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
          >
            <span className="text-2xl font-bold">×</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Alerta si fue cobrado del depósito */}
          {pago.servicios?.excedentes_cobrados_de === "deposito" && pago.servicios?.excedentes_del_deposito > 0 && (
            <div className="bg-purple-100 border-2 border-purple-400 rounded-lg p-3">
              <p className="text-purple-800 font-bold text-sm text-center">
                ⚡ Este pago tiene <span className="text-lg">${pago.servicios.excedentes_del_deposito}</span> cobrados del DEPÓSITO
              </p>
              <p className="text-purple-600 text-xs text-center mt-1">
                Puedes cambiar la opción abajo para cobrarlo de la renta en su lugar
              </p>
            </div>
          )}

          {/* Monto y Medio de Pago */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border-2 border-green-300">
              <label className="text-xs font-black text-green-700 uppercase block mb-2">
                💰 Monto Pagado
              </label>
              <div className="flex items-center">
                <span className="text-2xl font-black text-green-700 mr-2">$</span>
                <input 
                  type="number"
                  value={formData.monto_pagado}
                  onChange={(e) => setFormData({...formData, monto_pagado: Number(e.target.value)})}
                  className="w-full text-2xl font-black text-green-800 bg-transparent outline-none"
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-300">
              <label className="text-xs font-black text-blue-700 uppercase block mb-2">
                💳 Medio de Pago
              </label>
              <select
                value={formData.medio_pago}
                onChange={(e) => setFormData({...formData, medio_pago: e.target.value})}
                className="w-full text-lg font-bold text-blue-800 bg-transparent outline-none cursor-pointer"
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="deposito">Depósito</option>
              </select>
            </div>
          </div>

          {/* Fecha del Pago */}
          <div className="bg-amber-50 p-4 rounded-lg border-2 border-amber-300">
            <label className="text-xs font-black text-amber-700 uppercase block mb-2">
              📅 Fecha del Pago
            </label>
            <input 
              type="date"
              value={formData.fecha_pago_realizado}
              onChange={(e) => setFormData({...formData, fecha_pago_realizado: e.target.value})}
              className="w-full text-lg font-bold text-amber-800 bg-transparent outline-none"
            />
          </div>

          {/* Lecturas de Servicios */}
          <div className="bg-gradient-to-r from-cyan-50 to-yellow-50 p-4 rounded-lg border-2 border-cyan-300">
            <h3 className="text-center font-black text-cyan-700 uppercase text-sm mb-3">
              📊 Lecturas de Servicios
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-cyan-600 block mb-1">
                  💧 Agua (Límite: ${formData.limite_agua_aplicado})
                </label>
                <input 
                  type="number"
                  value={formData.agua_lectura}
                  onChange={(e) => setFormData({...formData, agua_lectura: Number(e.target.value)})}
                  className="w-full p-3 text-xl font-black text-center bg-white rounded border-2 border-cyan-300"
                />
                {excedentesActuales.excAgua > 0 && (
                  <p className="text-xs text-red-600 font-bold mt-1 text-center">
                    Excedente: ${excedentesActuales.excAgua}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-yellow-600 block mb-1">
                  ⚡ Luz (Límite: ${formData.limite_luz_aplicado})
                </label>
                <input 
                  type="number"
                  value={formData.luz_lectura}
                  onChange={(e) => setFormData({...formData, luz_lectura: Number(e.target.value)})}
                  className="w-full p-3 text-xl font-black text-center bg-white rounded border-2 border-yellow-300"
                />
                {excedentesActuales.excLuz > 0 && (
                  <p className="text-xs text-red-600 font-bold mt-1 text-center">
                    Excedente: ${excedentesActuales.excLuz}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* NUEVA SECCIÓN: Opción de cobro de excedentes (EDITABLE) */}
          {excedentesActuales.total > 0 && (
            <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-300">
              <p className="text-[10px] font-black text-purple-700 mb-3 uppercase text-center">
                ⚡ Excedentes Totales: ${excedentesActuales.total} (Agua: ${excedentesActuales.excAgua} + Luz: ${excedentesActuales.excLuz})
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-purple-100 transition">
                  <input 
                    type="radio" 
                    name="cobro_excedentes"
                    value="deposito"
                    checked={formData.cobrar_excedentes_de === "deposito"}
                    onChange={(e) => setFormData({...formData, cobrar_excedentes_de: e.target.value})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold text-purple-900">
                    Cobrar del depósito (Disponible: ${depositoDisponibleConDevolucion})
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-purple-100 transition">
                  <input 
                    type="radio" 
                    name="cobro_excedentes"
                    value="renta"
                    checked={formData.cobrar_excedentes_de === "renta"}
                    onChange={(e) => setFormData({...formData, cobrar_excedentes_de: e.target.value})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold text-purple-900">
                    Cobrar en la renta del mes
                  </span>
                </label>
              </div>
              {formData.cobrar_excedentes_de === "deposito" && depositoDisponibleConDevolucion < excedentesActuales.total && (
                <div className="mt-2 p-2 bg-red-100 border border-red-400 rounded text-xs text-red-700 font-bold">
                  ⚠️ Depósito insuficiente para cubrir excedentes
                </div>
              )}
              
              {/* Previsualización del cambio */}
              <div className="mt-3 p-3 bg-white rounded-lg border-2 border-purple-200">
                <p className="text-[9px] font-black text-gray-500 uppercase mb-2">Vista previa del cambio:</p>
                {(() => {
                  const excedentesOriginales = Math.max(0, (pago.servicios?.agua_lectura || 0) - (pago.servicios?.limite_agua_aplicado || 0)) +
                                                Math.max(0, (pago.servicios?.luz_lectura || 0) - (pago.servicios?.limite_luz_aplicado || 0));
                  const opcionOriginal = pago.servicios?.excedentes_cobrados_de || 'renta';
                  
                  let rentaBase = Number(pago.total_esperado_periodo || 0);
                  if (opcionOriginal === "renta") {
                    rentaBase = rentaBase - excedentesOriginales;
                  }

                  const nuevoTotal = formData.cobrar_excedentes_de === "deposito" 
                    ? rentaBase 
                    : rentaBase + excedentesActuales.total;

                  return (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Renta base:</span>
                        <span className="font-bold">${rentaBase}</span>
                      </div>
                      {formData.cobrar_excedentes_de === "renta" && (
                        <div className="flex justify-between text-amber-600">
                          <span>+ Excedentes:</span>
                          <span className="font-bold">+${excedentesActuales.total}</span>
                        </div>
                      )}
                      {formData.cobrar_excedentes_de === "deposito" && (
                        <div className="flex justify-between text-purple-600">
                          <span>Excedentes del depósito:</span>
                          <span className="font-bold">-${excedentesActuales.total}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="font-black text-gray-700">Total a cobrar:</span>
                        <span className="font-black text-green-600 text-lg">${nuevoTotal}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Límites (editables) */}
          <div className="bg-gray-100 p-4 rounded-lg border-2 border-gray-300">
            <h3 className="text-center font-black text-gray-700 uppercase text-xs mb-3">
              🎯 Límites Aplicados
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Límite Agua</label>
                <input 
                  type="number"
                  value={formData.limite_agua_aplicado}
                  onChange={(e) => setFormData({...formData, limite_agua_aplicado: Number(e.target.value)})}
                  className="w-full p-2 text-center font-bold bg-white rounded border border-gray-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Límite Luz</label>
                <input 
                  type="number"
                  value={formData.limite_luz_aplicado}
                  onChange={(e) => setFormData({...formData, limite_luz_aplicado: Number(e.target.value)})}
                  className="w-full p-2 text-center font-bold bg-white rounded border border-gray-300"
                />
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleEliminar}
              disabled={loading}
              className={`flex-1 py-3 rounded-lg font-black uppercase transition-all ${
                confirmandoEliminacion 
                  ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' 
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              } disabled:opacity-50`}
            >
              {confirmandoEliminacion ? '⚠️ CONFIRMAR ELIMINACIÓN' : '🗑️ Eliminar'}
            </button>
            <button
              onClick={handleGuardar}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-black uppercase hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {loading ? '⏳ Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>

          <button
            onClick={onCerrar}
            className="w-full bg-gray-300 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-400 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalEditarPago;