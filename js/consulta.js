// js/consulta.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    const params = new URLSearchParams(window.location.search);
    const codigoInicial = (params.get('codigo') || '').trim().toUpperCase();

    const inputCodigoManual = document.getElementById('inputCodigoManual');
    const estadoCarga = document.getElementById('estadoCarga');
    const estadoError = document.getElementById('estadoError');
    const contenedorFicha = document.getElementById('contenedorFicha');

    document.getElementById('formBuscarCodigo').addEventListener('submit', (e) => {
        e.preventDefault();
        const code = inputCodigoManual.value.trim().toUpperCase();
        if (code) {
            const nuevaUrl = `${window.location.pathname}?codigo=${encodeURIComponent(code)}`;
            window.history.replaceState({}, '', nuevaUrl);
            consultarTrazabilidad(code);
        }
    });

    async function consultarTrazabilidad(codigo) {
        estadoCarga.classList.remove('d-none');
        estadoError.classList.add('d-none');
        contenedorFicha.classList.add('d-none');

        try {
            // Consulta relacional completa desde codigo_qr hasta productor
            const { data: qrData, error: errQr } = await db
                .from('codigo_qr')
                .select(`
                    id_codigo,
                    codigo,
                    fecha_generacion,
                    producto (
                        id_producto,
                        nombre,
                        tipo_producto,
                        presentacion,
                        lote (
                            id_lote,
                            codigo_lote,
                            fecha_registro,
                            cantidad_kg,
                            cosecha (
                                id_cosecha,
                                fecha_cosecha,
                                cantidad_kg,
                                variedad_uva ( nombre, descripcion ),
                                parcela (
                                    nombre,
                                    ubicacion,
                                    area_hectareas,
                                    productor ( razon_social, documento, telefono )
                                )
                            )
                        )
                    )
                `)
                .eq('codigo', codigo)
                .maybeSingle();

            if (errQr) throw errQr;

            if (!qrData || !qrData.producto) {
                estadoCarga.classList.add('d-none');
                document.getElementById('mensajeErrorTexto').textContent =
                    `No se encontró ningún producto registrado con el código "${codigo}".`;
                estadoError.classList.remove('d-none');
                return;
            }

            const prod = qrData.producto;
            const lote = prod.lote || {};
            const cosecha = lote.cosecha || {};
            const variedad = cosecha.variedad_uva || {};
            const parcela = cosecha.parcela || {};
            const productor = parcela.productor || {};

            // Consultar los procesos cronológicos del lote
            let procesos = [];
            if (lote.id_lote) {
                const { data: procData } = await db
                    .from('proceso')
                    .select('nombre_proceso, fecha_proceso, descripcion')
                    .eq('id_lote', lote.id_lote)
                    .order('fecha_proceso', { ascending: true });
                procesos = procData || [];
            }

            // Poblar interfaz
            document.getElementById('fichaProductoNombre').textContent = prod.nombre || 'Pisco Peruano';
            document.getElementById('fichaProductoDetalle').textContent = `${prod.tipo_producto || ''} • ${prod.presentacion || ''}`;
            document.getElementById('fichaCodigoQr').textContent = qrData.codigo;
            document.getElementById('fichaFechaQr').textContent = `Emitido el ${qrData.fecha_generacion}`;

            document.getElementById('fichaVariedad').textContent = variedad.nombre || 'No especificada';
            document.getElementById('fichaLote').textContent = lote.codigo_lote || 'Sin lote';
            document.getElementById('fichaFechaCosecha').textContent = cosecha.fecha_cosecha || 'No registrada';
            document.getElementById('fichaKilosLote').textContent = `${Number(lote.cantidad_kg || 0).toLocaleString('es-PE')} kg`;

            document.getElementById('fichaProductorNombre').textContent = productor.razon_social || 'Productor no registrado';
            document.getElementById('fichaProductorDoc').textContent = `RUC/DNI: ${productor.documento || '-'} • Tel: ${productor.telefono || '-'}`;
            document.getElementById('fichaParcelaNombre').textContent = parcela.nombre || 'Parcela no registrada';
            document.getElementById('fichaParcelaUbicacion').textContent = parcela.ubicacion || '';
            document.getElementById('fichaParcelaArea').textContent = `Extensión: ${Number(parcela.area_hectareas || 0).toFixed(2)} hectáreas`;

            document.getElementById('fichaVariedadTitulo').textContent = variedad.nombre || 'Uva Pisquera';
            document.getElementById('fichaVariedadDesc').textContent = variedad.descripcion || '';
            document.getElementById('fichaCosechaTotal').textContent = `${Number(cosecha.cantidad_kg || 0).toLocaleString('es-PE')} kg cosechados`;

            const timelineEl = document.getElementById('fichaTimelineProcesos');
            if (!procesos.length) {
                timelineEl.innerHTML = `<p class="text-muted small mb-0">No hay etapas de proceso registradas para este lote.</p>`;
            } else {
                timelineEl.innerHTML = procesos.map(proc => `
                    <div class="timeline-item">
                        <div class="d-flex flex-wrap justify-content-between align-items-center mb-1">
                            <strong style="color: var(--color-borgona);">${escapeHtml(proc.nombre_proceso)}</strong>
                            <span class="badge bg-light text-dark border"><i class="bi bi-calendar3 me-1"></i>${escapeHtml(proc.fecha_proceso)}</span>
                        </div>
                        <p class="text-muted small mb-0">${escapeHtml(proc.descripcion)}</p>
                    </div>
                `).join('');
            }

            estadoCarga.classList.add('d-none');
            contenedorFicha.classList.remove('d-none');
        } catch (err) {
            estadoCarga.classList.add('d-none');
            document.getElementById('mensajeErrorTexto').textContent = 'Ocurrió un error al consultar la trazabilidad: ' + err.message;
            estadoError.classList.remove('d-none');
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    if (codigoInicial) {
        inputCodigoManual.value = codigoInicial;
        await consultarTrazabilidad(codigoInicial);
    }
});