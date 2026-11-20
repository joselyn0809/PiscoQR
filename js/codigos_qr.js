// js/codigos_qr.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    let listaQr = [];
    let idAEliminar = null;
    let codigoActualDescarga = 'QR_PISCO';

    const tbody = document.getElementById('tablaQrBody');
    const inputBuscar = document.getElementById('inputBuscar');
    const selectProducto = document.getElementById('selectProducto');
    const inputCodigoQr = document.getElementById('codigoQr');
    const inputUrlConsulta = document.getElementById('urlConsulta');

    const modalQr = new bootstrap.Modal(document.getElementById('modalQr'));
    const modalVerQr = new bootstrap.Modal(document.getElementById('modalVerQr'));
    const modalEliminar = new bootstrap.Modal(document.getElementById('modalEliminar'));
    const formQr = document.getElementById('formQr');

    // Construye dinámicamente la URL base hacia consulta.html en el servidor actual
    function construirUrlConsulta(codigo) {
        const basePath = window.location.href.replace(/\/pages\/codigos_qr\.html.*$/, '');
        return `${basePath}/consulta.html?codigo=${encodeURIComponent(codigo.trim().toUpperCase())}`;
    }

    inputCodigoQr.addEventListener('input', () => {
        if (inputCodigoQr.value.trim()) {
            inputUrlConsulta.value = construirUrlConsulta(inputCodigoQr.value);
        }
    });

    function generarCodigoAutomatico() {
        const anio = new Date().getFullYear();
        const correlativo = String(listaQr.length + 1).padStart(3, '0');
        const sufijo = Math.floor(10 + Math.random() * 89);
        const nuevoCodigo = `PSC-${anio}-${correlativo}${sufijo}`;
        inputCodigoQr.value = nuevoCodigo;
        inputUrlConsulta.value = construirUrlConsulta(nuevoCodigo);
    }

    document.getElementById('btnGenerarCodigo').addEventListener('click', generarCodigoAutomatico);

    // 1. Cargar Productos para el SELECT dinámico
    async function cargarSelectProductos() {
        try {
            const { data, error } = await db
                .from('producto')
                .select(`
                    id_producto,
                    nombre,
                    tipo_producto,
                    presentacion,
                    lote ( codigo_lote )
                `)
                .order('id_producto', { ascending: false });

            if (error) throw error;

            selectProducto.innerHTML = '<option value="">Seleccione un producto...</option>' +
                (data || []).map(p => {
                    const lote = p.lote?.codigo_lote || 'Sin lote';
                    return `<option value="${p.id_producto}">${escapeHtml(p.nombre)} — ${escapeHtml(p.presentacion)} [${escapeHtml(lote)}]</option>`;
                }).join('');
        } catch (err) {
            window.mostrarNotificacion('Error cargando lista de productos: ' + err.message, 'error');
        }
    }

    // 2. READ: Cargar códigos QR con datos del producto
    async function cargarCodigosQr() {
        try {
            const { data, error } = await db
                .from('codigo_qr')
                .select(`
                    id_codigo,
                    id_producto,
                    codigo,
                    url_consulta,
                    fecha_generacion,
                    producto (
                        nombre,
                        tipo_producto,
                        presentacion,
                        lote ( codigo_lote )
                    )
                `)
                .order('id_codigo', { ascending: false });

            if (error) throw error;
            listaQr = data || [];
            renderizarTabla(listaQr);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error al cargar datos: ${err.message}</td></tr>`;
            window.mostrarNotificacion('Error al cargar códigos QR: ' + err.message, 'error');
        }
    }

    function renderizarTabla(datos) {
        if (!datos.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron códigos QR generados.</td></tr>`;
            return;
        }

        tbody.innerHTML = datos.map(q => {
            const nomProducto = q.producto?.nombre || 'Producto';
            const detalleProducto = `${q.producto?.tipo_producto || ''} • ${q.producto?.presentacion || ''}`;
            const urlLocal = construirUrlConsulta(q.codigo);

            return `
                <tr>
                    <td class="fw-bold text-muted">#${q.id_codigo}</td>
                    <td>
                        <span class="badge px-3 py-2" style="background-color: var(--color-borgona); color: var(--color-dorado); letter-spacing: 0.5px;">
                            <i class="bi bi-qr-code me-1"></i>${escapeHtml(q.codigo)}
                        </span>
                    </td>
                    <td>
                        <div class="fw-semibold" style="color: var(--color-borgona);">${escapeHtml(nomProducto)}</div>
                        <small class="text-muted">${escapeHtml(detalleProducto)}</small>
                    </td>
                    <td class="text-nowrap"><i class="bi bi-calendar-check me-1 text-muted"></i>${escapeHtml(q.fecha_generacion)}</td>
                    <td>
                        <a href="${urlLocal}" target="_blank" class="btn btn-sm btn-outline-secondary">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Abrir Ficha Pública
                        </a>
                    </td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-sm btn-dorado me-1 btn-ver-qr" data-id="${q.id_codigo}" title="Ver y Descargar QR">
                            <i class="bi bi-qr-code-scan"></i> QR
                        </button>
                        <button class="btn btn-sm btn-outline-primary me-1 btn-editar" data-id="${q.id_codigo}" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${q.id_codigo}" data-nombre="${escapeHtml(q.codigo)}" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-ver-qr').forEach(btn => {
            btn.addEventListener('click', () => abrirVistaPreviaQr(Number(btn.dataset.id)));
        });

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => abrirModalEditar(Number(btn.dataset.id)));
        });

        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', () => abrirModalEliminar(Number(btn.dataset.id), btn.dataset.nombre));
        });
    }

    // Vista previa y generación de imagen QR real
    function abrirVistaPreviaQr(id) {
        const item = listaQr.find(q => q.id_codigo === id);
        if (!item) return;

        codigoActualDescarga = item.codigo;
        const urlTrazabilidad = construirUrlConsulta(item.codigo);

        document.getElementById('previewProductoNombre').textContent = item.producto?.nombre || 'Pisco Peruano';
        document.getElementById('previewCodigoTexto').textContent = item.codigo;
        document.getElementById('btnAbrirConsulta').href = urlTrazabilidad;

        const container = document.getElementById('qrCanvasContainer');
        container.innerHTML = '';

        new QRCode(container, {
            text: urlTrazabilidad,
            width: 190,
            height: 190,
            colorDark: '#5B1725',
            colorLight: '#FFFFFF',
            correctLevel: QRCode.CorrectLevel.H
        });

        modalVerQr.show();
    }

    // Descargar QR como imagen PNG
    document.getElementById('btnDescargarPng').addEventListener('click', () => {
        const canvas = document.querySelector('#qrCanvasContainer canvas');
        const img = document.querySelector('#qrCanvasContainer img');
        const dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);

        if (!dataUrl) return;

        const enlace = document.createElement('a');
        enlace.href = dataUrl;
        enlace.download = `QR_${codigoActualDescarga}.png`;
        enlace.click();
    });

    // Búsqueda en tiempo real
    inputBuscar.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase().trim();
        const filtrados = listaQr.filter(q =>
            q.codigo.toLowerCase().includes(termino) ||
            (q.producto?.nombre || '').toLowerCase().includes(termino) ||
            (q.producto?.lote?.codigo_lote || '').toLowerCase().includes(termino)
        );
        renderizarTabla(filtrados);
    });

    // Abrir modal Nuevo
    document.getElementById('btnNuevoQr').addEventListener('click', () => {
        formQr.reset();
        document.getElementById('idCodigo').value = '';
        document.getElementById('fechaGeneracion').valueAsDate = new Date();
        generarCodigoAutomatico();
        document.getElementById('modalQrTitulo').textContent = 'Generar Código QR';
        modalQr.show();
    });

    // Abrir modal Editar
    function abrirModalEditar(id) {
        const item = listaQr.find(q => q.id_codigo === id);
        if (!item) return;

        document.getElementById('idCodigo').value = item.id_codigo;
        document.getElementById('selectProducto').value = item.id_producto;
        document.getElementById('codigoQr').value = item.codigo;
        document.getElementById('urlConsulta').value = item.url_consulta;
        document.getElementById('fechaGeneracion').value = item.fecha_generacion;
        document.getElementById('modalQrTitulo').textContent = 'Editar Código QR';
        modalQr.show();
    }

    // 3. CREATE / UPDATE
    formQr.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idCodigo').value;
        const id_producto = Number(document.getElementById('selectProducto').value);
        const codigo = document.getElementById('codigoQr').value.trim().toUpperCase();
        const url_consulta = document.getElementById('urlConsulta').value.trim();
        const fecha_generacion = document.getElementById('fechaGeneracion').value;

        if (!id_producto || !codigo || !url_consulta || !fecha_generacion) {
            window.mostrarNotificacion('Todos los campos son obligatorios.', 'error');
            return;
        }

        const btnGuardar = document.getElementById('btnGuardarQr');
        btnGuardar.disabled = true;

        try {
            if (id) {
                const { error } = await db
                    .from('codigo_qr')
                    .update({ id_producto, codigo, url_consulta, fecha_generacion })
                    .eq('id_codigo', Number(id));
                if (error) throw error;
                window.mostrarNotificacion('Código QR actualizado correctamente.');
            } else {
                const { error } = await db
                    .from('codigo_qr')
                    .insert([{ id_producto, codigo, url_consulta, fecha_generacion }]);
                if (error) throw error;
                window.mostrarNotificacion('Código QR generado correctamente.');
            }

            modalQr.hide();
            await cargarCodigosQr();
        } catch (err) {
            window.mostrarNotificacion('Error al guardar código QR: ' + err.message, 'error');
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
                .from('codigo_qr')
                .delete()
                .eq('id_codigo', idAEliminar);

            if (error) throw error;

            modalEliminar.hide();
            window.mostrarNotificacion('Código QR eliminado correctamente.');
            await cargarCodigosQr();
        } catch (err) {
            modalEliminar.hide();
            window.mostrarNotificacion('Error al eliminar código QR: ' + err.message, 'error');
        }
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    await cargarSelectProductos();
    await cargarCodigosQr();
});