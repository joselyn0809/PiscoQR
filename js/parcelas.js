// js/parcelas.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    let listaParcelas = [];
    let idAEliminar = null;

    const tbody = document.getElementById('tablaParcelasBody');
    const inputBuscar = document.getElementById('inputBuscar');
    const selectProductor = document.getElementById('selectProductor');
    const modalParcela = new bootstrap.Modal(document.getElementById('modalParcela'));
    const modalEliminar = new bootstrap.Modal(document.getElementById('modalEliminar'));
    const formParcela = document.getElementById('formParcela');

    // 1. Cargar Productores para el SELECT dinámico
    async function cargarSelectProductores() {
        try {
            const { data, error } = await db
                .from('productor')
                .select('id_productor, razon_social, documento')
                .order('razon_social', { ascending: true });

            if (error) throw error;

            selectProductor.innerHTML = '<option value="">Seleccione un productor...</option>' +
                (data || []).map(p => `<option value="${p.id_productor}">${escapeHtml(p.razon_social)} (${escapeHtml(p.documento)})</option>`).join('');
        } catch (err) {
            window.mostrarNotificacion('Error cargando lista de productores: ' + err.message, 'error');
        }
    }

    // 2. READ: Cargar parcelas con el nombre del productor relacionado
    async function cargarParcelas() {
        try {
            const { data, error } = await db
                .from('parcela')
                .select(`
                    id_parcela,
                    id_productor,
                    nombre,
                    ubicacion,
                    area_hectareas,
                    productor ( razon_social )
                `)
                .order('id_parcela', { ascending: false });

            if (error) throw error;
            listaParcelas = data || [];
            renderizarTabla(listaParcelas);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error al cargar datos: ${err.message}</td></tr>`;
            window.mostrarNotificacion('Error al cargar parcelas: ' + err.message, 'error');
        }
    }

    function renderizarTabla(datos) {
        if (!datos.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron parcelas registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = datos.map(item => {
            const nombreProductor = item.productor?.razon_social || 'Sin productor';
            return `
                <tr>
                    <td class="fw-bold text-muted">#${item.id_parcela}</td>
                    <td class="fw-semibold" style="color: var(--color-borgona);">${escapeHtml(item.nombre)}</td>
                    <td><span class="badge" style="background-color: var(--color-crema); color: var(--color-borgona); border: 1px solid var(--color-dorado);">${escapeHtml(nombreProductor)}</span></td>
                    <td><i class="bi bi-pin-map me-1 text-muted"></i>${escapeHtml(item.ubicacion)}</td>
                    <td class="fw-semibold">${Number(item.area_hectareas).toFixed(2)} ha</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1 btn-editar" data-id="${item.id_parcela}" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${item.id_parcela}" data-nombre="${escapeHtml(item.nombre)}" title="Eliminar">
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
        const filtrados = listaParcelas.filter(item =>
            item.nombre.toLowerCase().includes(termino) ||
            item.ubicacion.toLowerCase().includes(termino) ||
            (item.productor?.razon_social || '').toLowerCase().includes(termino)
        );
        renderizarTabla(filtrados);
    });

    // Abrir modal Nuevo
    document.getElementById('btnNuevaParcela').addEventListener('click', () => {
        formParcela.reset();
        document.getElementById('idParcela').value = '';
        document.getElementById('modalParcelaTitulo').textContent = 'Nueva Parcela';
        modalParcela.show();
    });

    // Abrir modal Editar
    function abrirModalEditar(id) {
        const parcela = listaParcelas.find(p => p.id_parcela === id);
        if (!parcela) return;

        document.getElementById('idParcela').value = parcela.id_parcela;
        document.getElementById('selectProductor').value = parcela.id_productor;
        document.getElementById('nombreParcela').value = parcela.nombre;
        document.getElementById('ubicacionParcela').value = parcela.ubicacion;
        document.getElementById('areaHectareas').value = parcela.area_hectareas;
        document.getElementById('modalParcelaTitulo').textContent = 'Editar Parcela';
        modalParcela.show();
    }

    // 3. CREATE / UPDATE
    formParcela.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idParcela').value;
        const id_productor = Number(document.getElementById('selectProductor').value);
        const nombre = document.getElementById('nombreParcela').value.trim();
        const ubicacion = document.getElementById('ubicacionParcela').value.trim();
        const area_hectareas = parseFloat(document.getElementById('areaHectareas').value);

        if (!id_productor || !nombre || !ubicacion || isNaN(area_hectareas) || area_hectareas <= 0) {
            window.mostrarNotificacion('Completa todos los campos y verifica que el área sea mayor a 0.', 'error');
            return;
        }

        const btnGuardar = document.getElementById('btnGuardarParcela');
        btnGuardar.disabled = true;

        try {
            if (id) {
                const { error } = await db
                    .from('parcela')
                    .update({ id_productor, nombre, ubicacion, area_hectareas })
                    .eq('id_parcela', Number(id));
                if (error) throw error;
                window.mostrarNotificacion('Parcela actualizada correctamente.');
            } else {
                const { error } = await db
                    .from('parcela')
                    .insert([{ id_productor, nombre, ubicacion, area_hectareas }]);
                if (error) throw error;
                window.mostrarNotificacion('Parcela registrada correctamente.');
            }

            modalParcela.hide();
            await cargarParcelas();
        } catch (err) {
            window.mostrarNotificacion('Error al guardar parcela: ' + err.message, 'error');
        } finally {
            btnGuardar.disabled = false;
        }
    });

    // 4. DELETE con validación previa de cosechas asociadas
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
                .eq('id_parcela', idAEliminar);

            if (errCheck) throw errCheck;

            if (count > 0) {
                modalEliminar.hide();
                window.mostrarNotificacion(`No se puede eliminar: la parcela tiene ${count} cosecha(s) registrada(s).`, 'error');
                return;
            }

            const { error } = await db
                .from('parcela')
                .delete()
                .eq('id_parcela', idAEliminar);

            if (error) throw error;

            modalEliminar.hide();
            window.mostrarNotificacion('Parcela eliminada correctamente.');
            await cargarParcelas();
        } catch (err) {
            modalEliminar.hide();
            window.mostrarNotificacion('Error al eliminar parcela: ' + err.message, 'error');
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    await cargarSelectProductores();
    await cargarParcelas();
});