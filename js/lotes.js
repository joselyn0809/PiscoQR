// js/lotes.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    let listaLotes = [];
    let listaCosechas = [];
    let idAEliminar = null;

    const tbody = document.getElementById('tablaLotesBody');
    const inputBuscar = document.getElementById('inputBuscar');
    const selectCosecha = document.getElementById('selectCosecha');
    const infoSaldoCosecha = document.getElementById('infoSaldoCosecha');
    const modalLote = new bootstrap.Modal(document.getElementById('modalLote'));
    const modalEliminar = new bootstrap.Modal(document.getElementById('modalEliminar'));
    const formLote = document.getElementById('formLote');

    // 1. Cargar Cosechas y Lotes
    async function cargarDatos() {
        try {
            const [resCosechas, resLotes] = await Promise.all([
                db.from('cosecha')
                    .select(`
                        id_cosecha,
                        fecha_cosecha,
                        cantidad_kg,
                        parcela ( nombre, productor ( razon_social ) ),
                        variedad_uva ( nombre )
                    `)
                    .order('id_cosecha', { ascending: false }),
                db.from('lote')
                    .select(`
                        id_lote,
                        id_cosecha,
                        codigo_lote,
                        fecha_registro,
                        cantidad_kg,
                        cosecha (
                            fecha_cosecha,
                            parcela ( nombre, productor ( razon_social ) ),
                            variedad_uva ( nombre )
                        )
                    `)
                    .order('id_lote', { ascending: false })
            ]);

            if (resCosechas.error) throw resCosechas.error;
            if (resLotes.error) throw resLotes.error;

            listaCosechas = resCosechas.data || [];
            listaLotes = resLotes.data || [];

            poblarSelectCosechas();
            renderizarTabla(listaLotes);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error al cargar datos: ${err.message}</td></tr>`;
            window.mostrarNotificacion('Error al cargar lotes: ' + err.message, 'error');
        }
    }

    function calcularSaldoDisponible(idCosecha, idLoteActual = null) {
        const cosecha = listaCosechas.find(c => c.id_cosecha === idCosecha);
        if (!cosecha) return 0;

        const totalCosecha = Number(cosecha.cantidad_kg) || 0;
        const asignadoOtros = listaLotes
            .filter(l => l.id_cosecha === idCosecha && l.id_lote !== idLoteActual)
            .reduce((acc, l) => acc + (Number(l.cantidad_kg) || 0), 0);

        return Math.max(0, totalCosecha - asignadoOtros);
    }

    function poblarSelectCosechas() {
        selectCosecha.innerHTML = '<option value="">Seleccione una cosecha...</option>' +
            listaCosechas.map(c => {
                const variedad = c.variedad_uva?.nombre || 'Variedad';
                const parcela = c.parcela?.nombre || 'Parcela';
                const saldo = calcularSaldoDisponible(c.id_cosecha);
                return `<option value="${c.id_cosecha}">Cosecha #${c.id_cosecha} | ${escapeHtml(variedad)} - ${escapeHtml(parcela)} (${c.fecha_cosecha}) | Disp: ${saldo.toFixed(2)} kg</option>`;
            }).join('');
    }

    function actualizarInfoSaldo() {
        const idCosecha = Number(selectCosecha.value);
        const idLote = Number(document.getElementById('idLote').value) || null;
        if (!idCosecha) {
            infoSaldoCosecha.textContent = '';
            return;
        }
        const saldo = calcularSaldoDisponible(idCosecha, idLote);
        infoSaldoCosecha.innerHTML = `<i class="bi bi-info-circle me-1"></i>Saldo disponible en esta cosecha: <strong>${saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })} kg</strong>`;
    }

    selectCosecha.addEventListener('change', actualizarInfoSaldo);

    function generarCodigoAutomatico() {
        const anio = new Date().getFullYear();
        const siguiente = listaLotes.length + 1;
        const correlativo = String(siguiente).padStart(3, '0');
        const aleatorio = Math.floor(10 + Math.random() * 89);
        document.getElementById('codigoLote').value = `LOT-PIS-${anio}-${correlativo}${aleatorio}`;
    }

    document.getElementById('btnGenerarCodigo').addEventListener('click', generarCodigoAutomatico);

    function renderizarTabla(datos) {
        if (!datos.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron lotes registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = datos.map(l => {
            const variedad = l.cosecha?.variedad_uva?.nombre || 'Sin variedad';
            const parcela = l.cosecha?.parcela?.nombre || 'Sin parcela';
            const productor = l.cosecha?.parcela?.productor?.razon_social || 'Sin productor';

            return `
                <tr>
                    <td class="fw-bold text-muted">#${l.id_lote}</td>
                    <td>
                        <span class="badge px-3 py-2" style="background-color: var(--color-borgona); color: var(--color-dorado); letter-spacing: 0.5px;">
                            ${escapeHtml(l.codigo_lote)}
                        </span>
                    </td>
                    <td>
                        <div class="fw-semibold" style="color: var(--color-borgona);">${escapeHtml(variedad)}</div>
                        <small class="text-muted">${escapeHtml(parcela)} (${l.cosecha?.fecha_cosecha || ''})</small>
                    </td>
                    <td class="small text-muted">${escapeHtml(productor)}</td>
                    <td><i class="bi bi-calendar-check me-1 text-muted"></i>${escapeHtml(l.fecha_registro)}</td>
                    <td class="fw-bold">${Number(l.cantidad_kg).toLocaleString('es-PE', { minimumFractionDigits: 2 })} kg</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1 btn-editar" data-id="${l.id_lote}" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${l.id_lote}" data-nombre="${escapeHtml(l.codigo_lote)}" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => abrirModalEditar(Number(btn.dataset.id)));
        });

        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', () => abrirModalEliminar(Number(btn.dataset.id), btn.dataset.nombre));
        });
    }

    // Búsqueda en tiempo real
    inputBuscar.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase().trim();
        const filtrados = listaLotes.filter(l =>
            l.codigo_lote.toLowerCase().includes(termino) ||
            (l.cosecha?.variedad_uva?.nombre || '').toLowerCase().includes(termino) ||
            (l.cosecha?.parcela?.nombre || '').toLowerCase().includes(termino) ||
            (l.cosecha?.parcela?.productor?.razon_social || '').toLowerCase().includes(termino)
        );
        renderizarTabla(filtrados);
    });

    // Abrir modal Nuevo
    document.getElementById('btnNuevoLote').addEventListener('click', () => {
        formLote.reset();
        document.getElementById('idLote').value = '';
        document.getElementById('fechaRegistro').valueAsDate = new Date();
        infoSaldoCosecha.textContent = '';
        generarCodigoAutomatico();
        document.getElementById('modalLoteTitulo').textContent = 'Nuevo Lote';
        modalLote.show();
    });

    // Abrir modal Editar
    function abrirModalEditar(id) {
        const lote = listaLotes.find(l => l.id_lote === id);
        if (!lote) return;

        document.getElementById('idLote').value = lote.id_lote;
        document.getElementById('selectCosecha').value = lote.id_cosecha;
        document.getElementById('codigoLote').value = lote.codigo_lote;
        document.getElementById('fechaRegistro').value = lote.fecha_registro;
        document.getElementById('cantidadKg').value = lote.cantidad_kg;
        actualizarInfoSaldo();
        document.getElementById('modalLoteTitulo').textContent = 'Editar Lote';
        modalLote.show();
    }

    // 2. CREATE / UPDATE
    formLote.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idLote').value;
        const id_cosecha = Number(document.getElementById('selectCosecha').value);
        const codigo_lote = document.getElementById('codigoLote').value.trim().toUpperCase();
        const fecha_registro = document.getElementById('fechaRegistro').value;
        const cantidad_kg = parseFloat(document.getElementById('cantidadKg').value);

        if (!id_cosecha || !codigo_lote || !fecha_registro || isNaN(cantidad_kg) || cantidad_kg <= 0) {
            window.mostrarNotificacion('Completa todos los campos correctamente.', 'error');
            return;
        }

        const saldoDisponible = calcularSaldoDisponible(id_cosecha, id ? Number(id) : null);
        if (cantidad_kg > saldoDisponible) {
            window.mostrarNotificacion(`La cantidad (${cantidad_kg} kg) supera el saldo disponible de la cosecha (${saldoDisponible.toFixed(2)} kg).`, 'error');
            return;
        }

        const btnGuardar = document.getElementById('btnGuardarLote');
        btnGuardar.disabled = true;

        try {
            if (id) {
                const { error } = await db
                    .from('lote')
                    .update({ id_cosecha, codigo_lote, fecha_registro, cantidad_kg })
                    .eq('id_lote', Number(id));
                if (error) throw error;
                window.mostrarNotificacion('Lote actualizado correctamente.');
            } else {
                const { error } = await db
                    .from('lote')
                    .insert([{ id_cosecha, codigo_lote, fecha_registro, cantidad_kg }]);
                if (error) throw error;
                window.mostrarNotificacion('Lote registrado correctamente.');
            }

            modalLote.hide();
            await cargarDatos();
        } catch (err) {
            window.mostrarNotificacion('Error al guardar lote: ' + err.message, 'error');
        } finally {
            btnGuardar.disabled = false;
        }
    });

    // 3. DELETE con validación previa de procesos y productos
    function abrirModalEliminar(id, nombre) {
        idAEliminar = id;
        document.getElementById('nombreEliminar').textContent = nombre;
        modalEliminar.show();
    }

    document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
        if (!idAEliminar) return;

        try {
            const [resProc, resProd] = await Promise.all([
                db.from('proceso').select('*', { count: 'exact', head: true }).eq('id_lote', idAEliminar),
                db.from('producto').select('*', { count: 'exact', head: true }).eq('id_lote', idAEliminar)
            ]);

            if (resProc.error) throw resProc.error;
            if (resProd.error) throw resProd.error;

            if ((resProc.count || 0) > 0 || (resProd.count || 0) > 0) {
                modalEliminar.hide();
                window.mostrarNotificacion(`No se puede eliminar: el lote tiene ${resProc.count} proceso(s) y ${resProd.count} producto(s) asociados.`, 'error');
                return;
            }

            const { error } = await db
                .from('lote')
                .delete()
                .eq('id_lote', idAEliminar);

            if (error) throw error;

            modalEliminar.hide();
            window.mostrarNotificacion('Lote eliminado correctamente.');
            await cargarDatos();
        } catch (err) {
            modalEliminar.hide();
            window.mostrarNotificacion('Error al eliminar lote: ' + err.message, 'error');
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    await cargarDatos();
});