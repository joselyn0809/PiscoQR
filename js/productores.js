// js/productores.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    let listaProductores = [];
    let idAEliminar = null;

    const tbody = document.getElementById('tablaProductoresBody');
    const inputBuscar = document.getElementById('inputBuscar');
    const modalProductor = new bootstrap.Modal(document.getElementById('modalProductor'));
    const modalEliminar = new bootstrap.Modal(document.getElementById('modalEliminar'));
    const formProductor = document.getElementById('formProductor');

    // 1. READ: Cargar productores desde Supabase
    async function cargarProductores() {
        try {
            const { data, error } = await db
                .from('productor')
                .select('*')
                .order('id_productor', { ascending: false });

            if (error) throw error;
            listaProductores = data || [];
            renderizarTabla(listaProductores);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error al cargar datos: ${err.message}</td></tr>`;
            window.mostrarNotificacion('Error al cargar productores: ' + err.message, 'error');
        }
    }

    function renderizarTabla(datos) {
        if (!datos.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No se encontraron productores registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = datos.map(p => `
            <tr>
                <td class="fw-bold text-muted">#${p.id_productor}</td>
                <td class="fw-semibold" style="color: var(--color-borgona);">${escapeHtml(p.razon_social)}</td>
                <td><span class="badge bg-light text-dark border">${escapeHtml(p.documento)}</span></td>
                <td><i class="bi bi-telephone me-1 text-muted"></i>${escapeHtml(p.telefono)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1 btn-editar" data-id="${p.id_productor}" title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${p.id_productor}" data-nombre="${escapeHtml(p.razon_social)}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Eventos Editar
        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => abrirModalEditar(Number(btn.dataset.id)));
        });

        // Eventos Eliminar
        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', () => abrirModalEliminar(Number(btn.dataset.id), btn.dataset.nombre));
        });
    }

    // Búsqueda en tiempo real
    inputBuscar.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase().trim();
        const filtrados = listaProductores.filter(p =>
            p.razon_social.toLowerCase().includes(termino) ||
            p.documento.toLowerCase().includes(termino)
        );
        renderizarTabla(filtrados);
    });

    // Abrir modal Nuevo
    document.getElementById('btnNuevoProductor').addEventListener('click', () => {
        formProductor.reset();
        document.getElementById('idProductor').value = '';
        document.getElementById('modalProductorTitulo').textContent = 'Nuevo Productor';
        modalProductor.show();
    });

    // Abrir modal Editar
    function abrirModalEditar(id) {
        const prod = listaProductores.find(p => p.id_productor === id);
        if (!prod) return;

        document.getElementById('idProductor').value = prod.id_productor;
        document.getElementById('razonSocial').value = prod.razon_social;
        document.getElementById('documento').value = prod.documento;
        document.getElementById('telefono').value = prod.telefono;
        document.getElementById('modalProductorTitulo').textContent = 'Editar Productor';
        modalProductor.show();
    }

    // 2. CREATE / UPDATE
    formProductor.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idProductor').value;
        const razon_social = document.getElementById('razonSocial').value.trim();
        const documento = document.getElementById('documento').value.trim();
        const telefono = document.getElementById('telefono').value.trim();

        if (!razon_social || !documento || !telefono) {
            window.mostrarNotificacion('Todos los campos son obligatorios.', 'error');
            return;
        }

        const btnGuardar = document.getElementById('btnGuardarProductor');
        btnGuardar.disabled = true;

        try {
            if (id) {
                const { error } = await db
                    .from('productor')
                    .update({ razon_social, documento, telefono })
                    .eq('id_productor', Number(id));
                if (error) throw error;
                window.mostrarNotificacion('Productor actualizado correctamente.');
            } else {
                const { error } = await db
                    .from('productor')
                    .insert([{ razon_social, documento, telefono }]);
                if (error) throw error;
                window.mostrarNotificacion('Productor registrado correctamente.');
            }

            modalProductor.hide();
            await cargarProductores();
        } catch (err) {
            window.mostrarNotificacion('Error al guardar: ' + err.message, 'error');
        } finally {
            btnGuardar.disabled = false;
        }
    });

    // 3. DELETE con validación previa de dependencias
    function abrirModalEliminar(id, nombre) {
        idAEliminar = id;
        document.getElementById('nombreEliminar').textContent = nombre;
        modalEliminar.show();
    }

    document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
        if (!idAEliminar) return;

        try {
            // Verificar si tiene parcelas asociadas antes de eliminar
            const { count, error: errCheck } = await db
                .from('parcela')
                .select('*', { count: 'exact', head: true })
                .eq('id_productor', idAEliminar);

            if (errCheck) throw errCheck;

            if (count > 0) {
                modalEliminar.hide();
                window.mostrarNotificacion(`No se puede eliminar: el productor tiene ${count} parcela(s) registrada(s).`, 'error');
                return;
            }

            const { error } = await db
                .from('productor')
                .delete()
                .eq('id_productor', idAEliminar);

            if (error) throw error;

            modalEliminar.hide();
            window.mostrarNotificacion('Productor eliminado correctamente.');
            await cargarProductores();
        } catch (err) {
            modalEliminar.hide();
            window.mostrarNotificacion('Error al eliminar: ' + err.message, 'error');
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    await cargarProductores();
});