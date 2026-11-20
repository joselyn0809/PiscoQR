// js/cosechas.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    let listaCosechas = [];
    let idAEliminar = null;

    const tbody = document.getElementById('tablaCosechasBody');
    const inputBuscar = document.getElementById('inputBuscar');
    const selectParcela = document.getElementById('selectParcela');
    const selectVariedad = document.getElementById('selectVariedad');
    const modalCosecha = new bootstrap.Modal(document.getElementById('modalCosecha'));
    const modalEliminar = new bootstrap.Modal(document.getElementById('modalEliminar'));
    const formCosecha = document.getElementById('formCosecha');

    // 1. Cargar selects dinámicos (Parcelas con Productor y Variedades)
    async function cargarSelects() {
        try {
            const [resParcelas, resVariedades] = await Promise.all([
                db.from('parcela')
                    .select('id_parcela, nombre, productor ( razon_social )')
                    .order('nombre', { ascending: true }),
                db.from('variedad_uva')
                    .select('id_variedad, nombre')
                    .order('nombre', { ascending: true })
            ]);

            if (resParcelas.error) throw resParcelas.error;
            if (resVariedades.error) throw resVariedades.error;

            selectParcela.innerHTML = '<option value="">Seleccione una parcela...</option>' +
                (resParcelas.data || []).map(p => {
                    const prod = p.productor?.razon_social || 'Sin productor';
                    return `<option value="${p.id_parcela}">${escapeHtml(p.nombre)} — (${escapeHtml(prod)})</option>`;
                }).join('');

            selectVariedad.innerHTML = '<option value="">Seleccione una variedad...</option>' +
                (resVariedades.data || []).map(v => `<option value="${v.id_variedad}">${escapeHtml(v.nombre)}</option>`).join('');
        } catch (err) {
            window.mostrarNotificacion('Error cargando catálogos: ' + err.message, 'error');
        }
    }

    // 2. READ: Cargar cosechas con datos relacionados
    async function cargarCosechas() {
        try {
            const { data, error } = await db
                .from('cosecha')
                .select(`
                    id_cosecha,
                    id_parcela,
                    id_variedad,
                    fecha_cosecha,
                    cantidad_kg,
                    parcela ( nombre, productor ( razon_social ) ),
                    variedad_uva ( nombre )
                `)
                .order('id_cosecha', { ascending: false });

            if (error) throw error;
            listaCosechas = data || [];
            renderizarTabla(listaCosechas);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error al cargar datos: ${err.message}</td></tr>`;
            window.mostrarNotificacion('Error al cargar cosechas: ' + err.message, 'error');
        }
    }

    function renderizarTabla(datos) {
        if (!datos.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron cosechas registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = datos.map(c => {
            const nomParcela = c.parcela?.nombre || 'Sin parcela';
            const nomProductor = c.parcela?.productor?.razon_social || 'Sin productor';
            const nomVariedad = c.variedad_uva?.nombre || 'Sin variedad';
            const descEliminar = `Cosecha #${c.id_cosecha} (${nomVariedad} - ${c.fecha_cosecha})`;

            return `
                <tr>
                    <td class="fw-bold text-muted">#${c.id_cosecha}</td>
                    <td class="fw-semibold" style="color: var(--color-borgona);">${escapeHtml(nomParcela)}</td>
                    <td class="small text-muted">${escapeHtml(nomProductor)}</td>
                    <td>
                        <span class="badge" style="background-color: var(--color-crema); color: var(--color-borgona); border: 1px solid var(--color-dorado);">
                            ${escapeHtml(nomVariedad)}
                        </span>
                    </td>
                    <td><i class="bi bi-calendar-event me-1 text-muted"></i>${escapeHtml(c.fecha_cosecha)}</td>
                    <td class="fw-bold">${Number(c.cantidad_kg).toLocaleString('es-PE', { minimumFractionDigits: 2 })} kg</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1 btn-editar" data-id="${c.id_cosecha}" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${c.id_cosecha}" data-nombre="${escapeHtml(descEliminar)}" title="Eliminar">
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
        const filtrados = listaCosechas.filter(c =>
            (c.parcela?.nombre || '').toLowerCase().includes(termino) ||
            (c.parcela?.productor?.razon_social || '').toLowerCase().includes(termino) ||
            (c.variedad_uva?.nombre || '').toLowerCase().includes(termino) ||
            (c.fecha_cosecha || '').includes(termino)
        );
        renderizarTabla(filtrados);
    });

    // Abrir modal Nuevo
    document.getElementById('btnNuevaCosecha').addEventListener('click', () => {
        formCosecha.reset();
        document.getElementById('idCosecha').value = '';
        document.getElementById('fechaCosecha').valueAsDate = new Date();
        document.getElementById('modalCosechaTitulo').textContent = 'Nueva Cosecha';
        modalCosecha.show();
    });

    // Abrir modal Editar
    function abrirModalEditar(id) {
        const cosecha = listaCosechas.find(c => c.id_cosecha === id);
        if (!cosecha) return;

        document.getElementById('idCosecha').value = cosecha.id_cosecha;
        document.getElementById('selectParcela').value = cosecha.id_parcela;
        document.getElementById('selectVariedad').value = cosecha.id_variedad;
        document.getElementById('fechaCosecha').value = cosecha.fecha_cosecha;
        document.getElementById('cantidadKg').value = cosecha.cantidad_kg;
        document.getElementById('modalCosechaTitulo').textContent = 'Editar Cosecha';
        modalCosecha.show();
    }

    // 3. CREATE / UPDATE
    formCosecha.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idCosecha').value;
        const id_parcela = Number(document.getElementById('selectParcela').value);
        const id_variedad = Number(document.getElementById('selectVariedad').value);
        const fecha_cosecha = document.getElementById('fechaCosecha').value;
        const cantidad_kg = parseFloat(document.getElementById('cantidadKg').value);

        if (!id_parcela || !id_variedad || !fecha_cosecha || isNaN(cantidad_kg) || cantidad_kg <= 0) {
            window.mostrarNotificacion('Completa todos los campos y asegúrate de que los kilogramos sean mayores a 0.', 'error');
            return;
        }

        const btnGuardar = document.getElementById('btnGuardarCosecha');
        btnGuardar.disabled = true;

        try {
            if (id) {
                const { error } = await db
                    .from('cosecha')
                    .update({ id_parcela, id_variedad, fecha_cosecha, cantidad_kg })
                    .eq('id_cosecha', Number(id));
                if (error) throw error;
                window.mostrarNotificacion('Cosecha actualizada correctamente.');
            } else {
                const { error } = await db
                    .from('cosecha')
                    .insert([{ id_parcela, id_variedad, fecha_cosecha, cantidad_kg }]);
                if (error) throw error;
                window.mostrarNotificacion('Cosecha registrada correctamente.');
            }

            modalCosecha.hide();
            await cargarCosechas();
        } catch (err) {
            window.mostrarNotificacion('Error al guardar cosecha: ' + err.message, 'error');
        } finally {
            btnGuardar.disabled = false;
        }
    });

    // 4. DELETE con validación previa de lotes asociados
    function abrirModalEliminar(id, nombre) {
        idAEliminar = id;
        document.getElementById('nombreEliminar').textContent = nombre;
        modalEliminar.show();
    }

    document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
        if (!idAEliminar) return;

        try {
            const { count, error: errCheck } = await db
                .from('lote')
                .select('*', { count: 'exact', head: true })
                .eq('id_cosecha', idAEliminar);

            if (errCheck) throw errCheck;

            if (count > 0) {
                modalEliminar.hide();
                window.mostrarNotificacion(`No se puede eliminar: esta cosecha ya tiene ${count} lote(s) asignado(s).`, 'error');
                return;
            }

            const { error } = await db
                .from('cosecha')
                .delete()
                .eq('id_cosecha', idAEliminar);

            if (error) throw error;

            modalEliminar.hide();
            window.mostrarNotificacion('Cosecha eliminada correctamente.');
            await cargarCosechas();
        } catch (err) {
            modalEliminar.hide();
            window.mostrarNotificacion('Error al eliminar cosecha: ' + err.message, 'error');
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    await cargarSelects();
    await cargarCosechas();
});