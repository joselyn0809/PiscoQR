// js/variedades.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    let listaVariedades = [];
    let idAEliminar = null;

    const tbody = document.getElementById('tablaVariedadesBody');
    const inputBuscar = document.getElementById('inputBuscar');
    const modalVariedad = new bootstrap.Modal(document.getElementById('modalVariedad'));
    const modalEliminar = new bootstrap.Modal(document.getElementById('modalEliminar'));
    const formVariedad = document.getElementById('formVariedad');

    // 1. READ: Cargar variedades desde Supabase
    async function cargarVariedades() {
        try {
            const { data, error } = await db
                .from('variedad_uva')
                .select('*')
                .order('id_variedad', { ascending: false });

            if (error) throw error;
            listaVariedades = data || [];
            renderizarTabla(listaVariedades);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error al cargar datos: ${err.message}</td></tr>`;
            window.mostrarNotificacion('Error al cargar variedades: ' + err.message, 'error');
        }
    }

    function renderizarTabla(datos) {
        if (!datos.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No se encontraron variedades de uva registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = datos.map(v => `
            <tr>
                <td class="fw-bold text-muted">#${v.id_variedad}</td>
                <td>
                    <span class="badge px-3 py-2 fs-6" style="background-color: var(--color-crema); color: var(--color-borgona); border: 1px solid var(--color-dorado);">
                        <i class="bi bi-flower1 me-1" style="color: var(--color-dorado);"></i>${escapeHtml(v.nombre)}
                    </span>
                </td>
                <td class="text-muted small">${escapeHtml(v.descripcion)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1 btn-editar" data-id="${v.id_variedad}" title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${v.id_variedad}" data-nombre="${escapeHtml(v.nombre)}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

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
        const filtrados = listaVariedades.filter(v =>
            v.nombre.toLowerCase().includes(termino) ||
            v.descripcion.toLowerCase().includes(termino)
        );
        renderizarTabla(filtrados);
    });

    // Abrir modal Nuevo
    document.getElementById('btnNuevaVariedad').addEventListener('click', () => {
        formVariedad.reset();
        document.getElementById('idVariedad').value = '';
        document.getElementById('modalVariedadTitulo').textContent = 'Nueva Variedad de Uva';
        modalVariedad.show();
    });

    // Abrir modal Editar
    function abrirModalEditar(id) {
        const variedad = listaVariedades.find(v => v.id_variedad === id);
        if (!variedad) return;

        document.getElementById('idVariedad').value = variedad.id_variedad;
        document.getElementById('nombreVariedad').value = variedad.nombre;
        document.getElementById('descripcionVariedad').value = variedad.descripcion;
        document.getElementById('modalVariedadTitulo').textContent = 'Editar Variedad de Uva';
        modalVariedad.show();
    }

    // 2. CREATE / UPDATE
    formVariedad.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idVariedad').value;
        const nombre = document.getElementById('nombreVariedad').value.trim();
        const descripcion = document.getElementById('descripcionVariedad').value.trim();

        if (!nombre || !descripcion) {
            window.mostrarNotificacion('El nombre y la descripción son obligatorios.', 'error');
            return;
        }

        const btnGuardar = document.getElementById('btnGuardarVariedad');
        btnGuardar.disabled = true;

        try {
            if (id) {
                const { error } = await db
                    .from('variedad_uva')
                    .update({ nombre, descripcion })
                    .eq('id_variedad', Number(id));
                if (error) throw error;
                window.mostrarNotificacion('Variedad actualizada correctamente.');
            } else {
                const { error } = await db
                    .from('variedad_uva')
                    .insert([{ nombre, descripcion }]);
                if (error) throw error;
                window.mostrarNotificacion('Variedad registrada correctamente.');
            }

            modalVariedad.hide();
            await cargarVariedades();
        } catch (err) {
            window.mostrarNotificacion('Error al guardar variedad: ' + err.message, 'error');
        } finally {
            btnGuardar.disabled = false;
        }
    });

    // 3. DELETE con validación previa de cosechas asociadas
    function abrirModalEliminar(id, nombre) {
        idAEliminar = id;
        document.getElementById('nombreEliminar').textContent = nombre;
        modalEliminar.show();
    }

    document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
        if (!idAEliminar) return;

        try {
            const { count, error: errCheck } = await db
                .from('cosecha')
                .select('*', { count: 'exact', head: true })
                .eq('id_variedad', idAEliminar);

            if (errCheck) throw errCheck;

            if (count > 0) {
                modalEliminar.hide();
                window.mostrarNotificacion(`No se puede eliminar: existen ${count} cosecha(s) registrada(s) con esta variedad.`, 'error');
                return;
            }

            const { error } = await db
                .from('variedad_uva')
                .delete()
                .eq('id_variedad', idAEliminar);

            if (error) throw error;

            modalEliminar.hide();
            window.mostrarNotificacion('Variedad eliminada correctamente.');
            await cargarVariedades();
        } catch (err) {
            modalEliminar.hide();
            window.mostrarNotificacion('Error al eliminar variedad: ' + err.message, 'error');
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    await cargarVariedades();
});