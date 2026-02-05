import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

// Configuración de Firebase (usa variables de entorno)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verificarCoherenciaDespuesPago(inquilinoId) {
  console.log(`🔍 Iniciando verificación de coherencia para inquilino: ${inquilinoId}`);
  console.log("=".repeat(80));

  try {
    // 1. Obtener datos del inquilino
    console.log("📋 1. Consultando datos del INQUILINO...");
    const inquilinoRef = doc(db, "INQUILINOS", inquilinoId);
    const inquilinoSnap = await getDoc(inquilinoRef);

    if (!inquilinoSnap.exists()) {
      console.error(`❌ Error: Inquilino ${inquilinoId} no encontrado`);
      return;
    }

    const inquilino = inquilinoSnap.data();
    console.log(`✅ Inquilino encontrado: ${inquilino.nombre_completo}`);
    console.log(`   - ID Contrato actual: ${inquilino.id_contrato_actual}`);
    console.log(`   - ID Unidad actual: ${inquilino.id_unidad_actual}`);
    console.log(`   - Adeudos registrados: $${inquilino.adeudos || 0}`);
    console.log(`   - Último pago: ${inquilino.lastPaymentDate ? new Date(inquilino.lastPaymentDate.toDate()).toLocaleString() : 'Nunca'}`);
    console.log(`   - Renta actual: $${inquilino.renta_actual}`);
    console.log(`   - Activo: ${inquilino.activo ? 'Sí' : 'No'}`);

    // 2. Obtener contrato actual
    console.log("\n📄 2. Consultando CONTRATO actual...");
    const contratoRef = doc(db, "CONTRATOS", inquilino.id_contrato_actual);
    const contratoSnap = await getDoc(contratoRef);

    if (!contratoSnap.exists()) {
      console.error(`❌ Error: Contrato ${inquilino.id_contrato_actual} no encontrado`);
      return;
    }

    const contrato = contratoSnap.data();
    console.log(`✅ Contrato encontrado: ${contrato.id}`);
    console.log(`   - Monto renta: $${contrato.monto_renta}`);
    console.log(`   - Períodos totales: ${contrato.total_periodos}`);
    console.log(`   - Períodos pagados: ${contrato.periodos_pagados}`);
    console.log(`   - Estatus: ${contrato.estatus}`);

    // Calcular adeudos esperados desde periodos_esperados
    let adeudosEsperados = 0;
    let periodosPendientes = [];
    contrato.periodos_esperados.forEach(periodo => {
      if (periodo.estatus !== 'pagado') {
        adeudosEsperados += periodo.saldo_restante;
        periodosPendientes.push({
          periodo: periodo.periodo,
          estatus: periodo.estatus,
          saldo: periodo.saldo_restante
        });
      }
    });

    console.log(`   - Adeudos calculados desde periodos: $${adeudosEsperados}`);
    console.log(`   - Períodos pendientes: ${periodosPendientes.length}`);
    periodosPendientes.forEach(p => {
      console.log(`     * ${p.periodo}: ${p.estatus} - Saldo: $${p.saldo}`);
    });

    // 3. Obtener todos los pagos del inquilino
    console.log("\n💰 3. Consultando PAGOS del inquilino...");
    const pagosQuery = query(collection(db, "PAGOS"), where("id_inquilino", "==", inquilinoId));
    const pagosSnap = await getDocs(pagosQuery);

    let totalPagado = 0;
    let pagosRecientes = [];
    let pagosPorPeriodo = {};

    pagosSnap.forEach(doc => {
      const pago = doc.data();
      totalPagado += pago.monto_pagado;

      // Agrupar por período
      if (!pagosPorPeriodo[pago.periodo]) {
        pagosPorPeriodo[pago.periodo] = [];
      }
      pagosPorPeriodo[pago.periodo].push(pago);

      // Últimos 5 pagos
      if (pagosRecientes.length < 5) {
        pagosRecientes.push({
          id: doc.id,
          periodo: pago.periodo,
          monto: pago.monto_pagado,
          fecha: pago.fecha_pago_realizado ? new Date(pago.fecha_pago_realizado.toDate()).toLocaleString() : 'N/A',
          medio: pago.medio_pago,
          estatus: pago.estatus
        });
      }
    });

    console.log(`✅ Total de pagos encontrados: ${pagosSnap.size}`);
    console.log(`   - Monto total pagado: $${totalPagado}`);
    console.log("   - Últimos pagos:");
    pagosRecientes.forEach(pago => {
      console.log(`     * ${pago.fecha} - ${pago.periodo}: $${pago.monto} (${pago.medio})`);
    });

    // 4. Verificar coherencia
    console.log("\n🔍 4. VERIFICANDO COHERENCIA...");

    let errores = [];
    let advertencias = [];

    // Verificar adeudos
    if (Math.abs((inquilino.adeudos || 0) - adeudosEsperados) > 0.01) {
      errores.push(`Adeudos del inquilino ($${inquilino.adeudos || 0}) no coinciden con cálculo de periodos ($${adeudosEsperados})`);
    } else {
      console.log("✅ Adeudos del inquilino coinciden con periodos pendientes");
    }

    // Verificar pagos por período
    contrato.periodos_esperados.forEach(periodo => {
      const pagosPeriodo = pagosPorPeriodo[periodo.periodo] || [];
      const totalPagadoPeriodo = pagosPeriodo.reduce((sum, p) => sum + p.monto_pagado, 0);

      if (Math.abs(totalPagadoPeriodo - (periodo.monto_esperado - periodo.saldo_restante)) > 0.01) {
        errores.push(`Período ${periodo.periodo}: Pagos totales ($${totalPagadoPeriodo}) no coinciden con monto pagado esperado ($${periodo.monto_esperado - periodo.saldo_restante})`);
      }
    });

    // Verificar periodos pagados
    const periodosCompletamentePagados = contrato.periodos_esperados.filter(p => p.estatus === 'pagado').length;
    if (periodosCompletamentePagados !== contrato.periodos_pagados) {
      errores.push(`Períodos pagados en contrato (${contrato.periodos_pagados}) no coinciden con conteo real (${periodosCompletamentePagados})`);
    }

    // Verificar último pago
    if (pagosSnap.size > 0) {
      const ultimoPago = pagosSnap.docs
        .map(doc => doc.data())
        .sort((a, b) => b.fecha_registro.toMillis() - a.fecha_registro.toMillis())[0];

      if (inquilino.lastPaymentDate) {
        const diff = Math.abs(ultimoPago.fecha_registro.toMillis() - inquilino.lastPaymentDate.toMillis());
        if (diff > 1000) { // 1 segundo de tolerancia
          advertencias.push(`Fecha último pago en inquilino (${new Date(inquilino.lastPaymentDate.toDate()).toISOString()}) no coincide exactamente con último pago registrado (${new Date(ultimoPago.fecha_registro.toDate()).toISOString()})`);
        }
      } else {
        errores.push("Inquilino no tiene lastPaymentDate pero tiene pagos registrados");
      }
    }

    // 5. Resumen
    console.log("\n📊 5. RESUMEN DE VERIFICACIÓN");
    console.log("=".repeat(40));

    if (errores.length === 0) {
      console.log("🎉 ¡EXCELENTE! No se encontraron errores de coherencia.");
    } else {
      console.log(`❌ Se encontraron ${errores.length} error(es):`);
      errores.forEach((error, i) => console.log(`   ${i + 1}. ${error}`));
    }

    if (advertencias.length > 0) {
      console.log(`⚠️  ${advertencias.length} advertencia(s):`);
      advertencias.forEach((adv, i) => console.log(`   ${i + 1}. ${adv}`));
    }

    console.log("\n📈 ESTADÍSTICAS:");
    console.log(`   - Total pagado: $${totalPagado}`);
    console.log(`   - Adeudos pendientes: $${adeudosEsperados}`);
    console.log(`   - Pagos registrados: ${pagosSnap.size}`);
    console.log(`   - Períodos pendientes: ${periodosPendientes.length}/${contrato.total_periodos}`);

  } catch (error) {
    console.error("❌ Error durante la verificación:", error);
  }
}

// Ejecutar si se pasa ID como argumento
const inquilinoId = process.argv[2];
if (!inquilinoId) {
  console.log("Uso: node test.js <ID_INQUILINO>");
  console.log("Ejemplo: node test.js inq_1234567890");
  process.exit(1);
}

verificarCoherenciaDespuesPago(inquilinoId);