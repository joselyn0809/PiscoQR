// js/procesos.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    let listaProcesos = [];
    let idAEliminar = null;

    const tbody = document.getElementById('tablaProcesosBody');
    const inputBuscar = document.getElementById('inputBuscar');
    const selectLote = document.getElementById('selectLote');
    const modalProceso = new bootstrap.Modal(document.getElementById('modalProceso'));
    const modalEliminar = new bootstrap.Modal(document.getElementById('modalEliminar'));
    const formProceso = document.getElementById('formProceso');

    // 1. Cargar Lotes para el SELECT dinámico
    async function cargarSelectLotes() {
        try {
            const { data, error } = await db
                .from('lote')
                .select(`
                    id_lote,
                    codigo_lote,
                    cosecha ( variedad_uva ( nombre ), parcela ( nombre ) )
                `)
                .order('id_lote', { ascending: false });

            if (error) throw error;

            selectLote.innerHTML = '<option value="">Seleccione un lote...</option>' +
                (data || []).map(l => {
                    const variedad = l.cosecha?.variedad_uva?.nombre || 'Variedad';
                    const parcela = l.cosecha?.parcela?.nombre || 'Parcela';
                    return `<option value="${l.id_lote}">${escapeHtml(l.codigo_lote)} — (${escapeHtml(variedad)} / ${escapeHtml(parcela)})</option>`;
                }).join('');
        } catch (err) {
            window.mostrarNotificacion('Error cargando lista de lotes: ' + err.message, 'error');
        }
    }

    // 2. READ: Cargar procesos con datos del lote relacionado
    async function cargarProcesos() {
        try {
            const { data, error } = await db
                .from('proceso')
                .select(`
                    id_proceso,
                    id_lote,
                    nombre_proceso,
                    fecha_proceso,
                    descripcion,
                    lote ( codigo_lote, cosecha ( variedad_uva ( nombre ) ) )
                `)
                .order('id_proceso', { ascending: false });

            if (error) throw error;
            listaProcesos = data || [];
            renderizarTabla(listaProcesos);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error al cargar datos: ${err.message}</td></tr>`;
            window.mostrarNotificacion('Error al cargar procesos: ' + err.message, 'error');
        }
    }

    function renderizarTabla(datos) {
        if (!datos.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron procesos registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = datos.map(p => {
            const codLote = p.lote?.codigo_lote || 'Sin lote';
            const variedad = p.lote?.cosecha?.variedad_uva?.nombre || '';

            return `
                <tr>
                    <td class="fw-bold text-muted">#${p.id_proceso}</td>
                    <td>
                        <span class="badge px-2 py-1" style="background-color: var(--color-borgona); color: var(--color-dorado);">
                            ${escapeHtml(codLote)}
                        </span>
                        <div class="small text-muted mt-1">${escapeHtml(variedad)}</div>
                    </td>
                    <td class="fw-semibold" style="color: var(--color-borgona);">${escapeHtml(p.nombre_proceso)}</td>
                    <td class="text-nowrap"><i class="bi bi-calendar-event me-1 text-muted"></i>${escapeHtml(p.fecha_proceso)}</td>
                    <td class="small text-muted">${escapeHtml(p.descripcion)}</td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-sm btn-outline-primary me-1 btn-editar" data-id="${p.id_proceso}" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${p.id_proceso}" data-nombre="${escapeHtml(p.nombre_proceso)}" title="Eliminar">
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
        const filtrados = listaProcesos.filter(p =>
            (p.lote?.codigo_lote || '').toLowerCase().includes(termino) ||
            p.nombre_proceso.toLowerCase().includes(termino) ||
            p.descripcion.toLowerCase().includes(termino)
        );
        renderizarTabla(filtrados);
    });

    // Abrir modal Nuevo
    document.getElementById('btnNuevoProceso').addEventListener('click', () => {
        formProceso.reset();
        document.getElementById('idProceso').value = '';
        document.getElementById('fechaProceso').valueAsDate = new Date();
        document.getElementById('modalProcesoTitulo').textContent = 'Nuevo Proceso';
        modalProceso.show();
    });

    // Abrir modal Editar
    function abrirModalEditar(id) {
        const proc = listaProcesos.find(p => p.id_proceso === id);
        if (!proc) return;

        document.getElementById('idProceso').value = proc.id_proceso;
        document.getElementById('selectLote').value = proc.id_lote;
        document.getElementById('nombreProceso').value = proc.nombre_proceso;
        document.getElementById('fechaProceso').value = proc.fecha_proceso;
        document.getElementById('descripcionProceso').value = proc.descripcion;
        document.getElementById('modalProcesoTitulo').textContent = 'Editar Proceso';
        modalProceso.show();
    }

    // 3. CREATE / UPDATE
    formProceso.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idProceso').value;
        const id_lote = Number(document.getElementById('selectLote').value);
        const nombre_proceso = document.getElementById('nombreProceso').value.trim();
        const fecha_proceso = document.getElementById('fechaProceso').value;
        const descripcion = document.getElementById('descripcionProceso').value.trim();

        if (!id_lote || !nombre_proceso || !fecha_proceso || !descripcion) {
            window.mostrarNotificacion('Todos los campos son obligatorios.', 'error');
            return;
        }

        const btnGuardar = document.getElementById('btnGuardarProceso');
        btnGuardar.disabled = true;

        try {
            if (id) {
                const { error } = await db
                    .from('proceso')
                    .update({ id_lote, nombre_proceso, fecha_proceso, descripcion })
                    .eq('id_proceso', Number(id));
                if (error) throw error;
                window.mostrarNotificacion('Proceso actualizado correctamente.');
            } else {
                const { error } = await db
                    .from('proceso')
                    .insert([{ id_lote, nombre_proceso, fecha_proceso, descripcion }]);
                if (error) throw error;
                window.mostrarNotificacion('Proceso registrado correctamente.');
            }

            modalProceso.hide();
            await cargarProcesos();
        } catch (err) {
            window.mostrarNotificacion('Error al guardar proceso: ' + err.message, 'error');
        } finally {
            btnGuardar.disabled = false;
        }
    });

    // 4. DELETE
    function abrirModalEliminar(id, nombre) {
        idAEliminar = id;
        document.getElementById('nombreEliminar').textContent = nombre;
        modalEliminar.show();
    }

    document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
        if (!idAEliminar) return;

        try {
            const { error } = await db
                .from('proceso')
                .delete()
                .eq('id_proceso', idAEliminar);

            if (error) throw error;

            modalEliminar.hide();
            window.mostrarNotificacion('Proceso eliminado correctamente.');
            await cargarProcesos();
        } catch (err) {
            modalEliminar.hide();
            window.mostrarNotificacion('Error al eliminar proceso: ' + err.message, 'error');
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    await cargarSelectLotes();
    await cargarProcesos();
});