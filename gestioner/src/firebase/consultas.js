import { db } from './config'; // Tu archivo de config de Firebase
import { collection, getDocs, query, where } from 'firebase/firestore';

export const getDatosDashboard = async (periodoActual) => {
  try {
    // 1. Traer todas las unidades rentadas
    const unidadesSnapshot = await getDocs(collection(db, "unidades"));
    const unidades = unidadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Traer los pagos realizados en este periodo
    const pagosQuery = query(
      collection(db, "pagos"), 
      where("periodo", "==", periodoActual)
    );
    const pagosSnapshot = await getDocs(pagosQuery);
    const pagosRealizados = pagosSnapshot.docs.map(doc => doc.data().id_unidad);

    // 3. Lógica de cruce
    let totalEsperado = 0;
    let totalPagado = 0;
    const listaAdeudos = [];
    const unidadesLibres = [];

    unidades.forEach(unidad => {
      if (unidad.estado === "Disponible") {
        unidadesLibres.push(unidad);
      } else {
        // Es una unidad rentada
        totalEsperado += unidad.renta_mensual;
        
        if (pagosRealizados.includes(unidad.id)) {
          totalPagado += unidad.renta_mensual;
        } else {
          // Si no está en los pagos, es un adeudo
          listaAdeudos.push({
            id: unidad.id,
            nombre: unidad.nombre_inquilino,
            monto: unidad.renta_mensual,
            propiedad: unidad.id_propiedad,
            // Aquí podrías traer el dia_pago del inquilino si haces un join más complejo
          });
        }
      }
    });

    return {
      stats: {
        esperado: totalEsperado,
        pagado: totalPagado,
        adeudo: totalEsperado - totalPagado
      },
      listaAdeudos,
      unidadesLibres,
      todasLasUnidades: unidades
    };
  } catch (error) {
    console.error("Error consultando Dashboard:", error);
    return null;
  }
};