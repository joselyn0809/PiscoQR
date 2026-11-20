// js/productos.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    let listaProductos = [];
    let idAEliminar = null;

    const tbody = document.getElementById('tablaProductosBody');
    const inputBuscar = document.getElementById('inputBuscar');
    const selectLote = document.getElementById('selectLote');
    const modalProducto = new bootstrap.Modal(document.getElementById('modalProducto'));
    const modalEliminar = new bootstrap.Modal(document.getElementById('modalEliminar'));
    const formProducto = document.getElementById('formProducto');

    // 1. Cargar Lotes para el SELECT dinámico
    async function cargarSelectLotes() {
        try {
            const { data, error } = await db
                .from('lote')
                .select(`
                    id_lote,
                    codigo_lote,
                    cosecha (
                        variedad_uva ( nombre ),
                        parcela ( productor ( razon_social ) )
                    )
                `)
                .order('id_lote', { ascending: false });

            if (error) throw error;

            selectLote.innerHTML = '<option value="">Seleccione un lote...</option>' +
                (data || []).map(l => {
                    const variedad = l.cosecha?.variedad_uva?.nombre || 'Variedad';
                    const productor = l.cosecha?.parcela?.productor?.razon_social || 'Productor';
                    return `<option value="${l.id_lote}">${escapeHtml(l.codigo_lote)} — (${escapeHtml(variedad)} | ${escapeHtml(productor)})</option>`;
                }).join('');
        } catch (err) {
            window.mostrarNotificacion('Error cargando lista de lotes: ' + err.message, 'error');
        }
    }

    // 2. READ: Cargar productos con su lote relacionado
    async function cargarProductos() {
        try {
            const { data, error } = await db
                .from('producto')
                .select(`
                    id_producto,
                    id_lote,
                    nombre,
                    tipo_producto,
                    presentacion,
                    lote ( codigo_lote, cosecha ( variedad_uva ( nombre ) ) )
                `)
                .order('id_producto', { ascending: false });

            if (error) throw error;
            listaProductos = data || [];
            renderizarTabla(listaProductos);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error al cargar datos: ${err.message}</td></tr>`;
            window.mostrarNotificacion('Error al cargar productos: ' + err.message, 'error');
        }
    }

    function renderizarTabla(datos) {
        if (!datos.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron productos registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = datos.map(p => {
            const codLote = p.lote?.codigo_lote || 'Sin lote';
            const variedad = p.lote?.cosecha?.variedad_uva?.nombre || '';

            return `
                <tr>
                    <td class="fw-bold text-muted">#${p.id_producto}</td>
                    <td class="fw-semibold" style="color: var(--color-borgona);">${escapeHtml(p.nombre)}</td>
                    <td>
                        <span class="badge px-2 py-1" style="background-color: var(--color-crema); color: var(--color-borgona); border: 1px solid var(--color-dorado);">
                            ${escapeHtml(p.tipo_producto)}
                        </span>
                    </td>
                    <td class="text-muted"><i class="bi bi-box-seam me-1"></i>${escapeHtml(p.presentacion)}</td>
                    <td>
                        <span class="badge bg-dark">${escapeHtml(codLote)}</span>
                        <div class="small text-muted">${escapeHtml(variedad)}</div>
                    </td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-sm btn-outline-primary me-1 btn-editar" data-id="${p.id_producto}" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${p.id_producto}" data-nombre="${escapeHtml(p.nombre)}" title="Eliminar">
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
        const filtrados = listaProductos.filter(p =>
            p.nombre.toLowerCase().includes(termino) ||
            p.tipo_producto.toLowerCase().includes(termino) ||
            p.presentacion.toLowerCase().includes(termino) ||
            (p.lote?.codigo_lote || '').toLowerCase().includes(termino)
        );
        renderizarTabla(filtrados);
    });

    // Abrir modal Nuevo
    document.getElementById('btnNuevoProducto').addEventListener('click', () => {
        formProducto.reset();
        document.getElementById('idProducto').value = '';
        document.getElementById('modalProductoTitulo').textContent = 'Nuevo Producto';
        modalProducto.show();
    });

    // Abrir modal Editar
    function abrirModalEditar(id) {
        const prod = listaProductos.find(p => p.id_producto === id);
        if (!prod) return;

        document.getElementById('idProducto').value = prod.id_producto;
        document.getElementById('selectLote').value = prod.id_lote;
        document.getElementById('nombreProducto').value = prod.nombre;
        document.getElementById('tipoProducto').value = prod.tipo_producto;
        document.getElementById('presentacionProducto').value = prod.presentacion;
        document.getElementById('modalProductoTitulo').textContent = 'Editar Producto';
        modalProducto.show();
    }

    // 3. CREATE / UPDATE
    formProducto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idProducto').value;
        const id_lote = Number(document.getElementById('selectLote').value);
        const nombre = document.getElementById('nombreProducto').value.trim();
        const tipo_producto = document.getElementById('tipoProducto').value.trim();
        const presentacion = document.getElementById('presentacionProducto').value.trim();

        if (!id_lote || !nombre || !tipo_producto || !presentacion) {
            window.mostrarNotificacion('Todos los campos son obligatorios.', 'error');
            return;
        }

        const btnGuardar = document.getElementById('btnGuardarProducto');
        btnGuardar.disabled = true;

        try {
            if (id) {
                const { error } = await db
                    .from('producto')
                    .update({ id_lote, nombre, tipo_producto, presentacion })
                    .eq('id_producto', Number(id));
                if (error) throw error;
                window.mostrarNotificacion('Producto actualizado correctamente.');
            } else {
                const { error } = await db
                    .from('producto')
                    .insert([{ id_lote, nombre, tipo_producto, presentacion }]);
                if (error) throw error;
                window.mostrarNotificacion('Producto registrado correctamente.');
            }

            modalProducto.hide();
            await cargarProductos();
        } catch (err) {
            window.mostrarNotificacion('Error al guardar producto: ' + err.message, 'error');
        } finally {
            btnGuardar.disabled = false;
        }
    });

    // 4. DELETE con validación previa de códigos QR asociados
    function abrirModalEliminar(id, nombre) {
        idAEliminar = id;
        document.getElementById('nombreEliminar').textContent = nombre;
        modalEliminar.show();
    }

    document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
        if (!idAEliminar) return;

        try {
            const { count, error: errCheck } = await db
                .from('codigo_qr')
                .select('*', { count: 'exact', head: true })
                .eq('id_producto', idAEliminar);

            if (errCheck) throw errCheck;

            if (count > 0) {
                modalEliminar.hide();
                window.mostrarNotificacion(`No se puede eliminar: el producto tiene ${count} código(s) QR generado(s).`, 'error');
                return;
            }

            const { error } = await db
                .from('producto')
                .delete()
                .eq('id_producto', idAEliminar);

            if (error) throw error;

            modalEliminar.hide();
            window.mostrarNotificacion('Producto eliminado correctamente.');
            await cargarProductos();
        } catch (err) {
            modalEliminar.hide();
            window.mostrarNotificacion('Error al eliminar producto: ' + err.message, 'error');
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    await cargarSelectLotes();
    await cargarProductos();
});