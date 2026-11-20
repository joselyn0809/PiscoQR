// js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    const db = window.supabaseClient;
    if (!db) return;

    const paletaPisco = ['#5B1725', '#C8A45D', '#7B2638', '#9E4758', '#D9BE82', '#3D0F18', '#A67C37'];

    // 1. Cargar contadores reales de las 8 tablas
    async function cargarContadores() {
        const tablas = [
            { tabla: 'productor', elementId: 'countProductores' },
            { tabla: 'parcela', elementId: 'countParcelas' },
            { tabla: 'variedad_uva', elementId: 'countVariedades' },
            { tabla: 'cosecha', elementId: 'countCosechas' },
            { tabla: 'lote', elementId: 'countLotes' },
            { tabla: 'proceso', elementId: 'countProcesos' },
            { tabla: 'producto', elementId: 'countProductos' },
            { tabla: 'codigo_qr', elementId: 'countQr' }
        ];

        await Promise.all(tablas.map(async (item) => {
            try {
                const { count, error } = await db
                    .from(item.tabla)
                    .select('*', { count: 'exact', head: true });

                if (error) throw error;
                const el = document.getElementById(item.elementId);
                if (el) el.textContent = count ?? 0;
            } catch (err) {
                console.error(`Error contando ${item.tabla}:`, err.message);
            }
        }));
    }

    // 2. Cargar datos y renderizar los 4 gráficos con tus columnas reales
    async function cargarGraficos() {
        try {
            const { data: cosechas, error: errCosechas } = await db
                .from('cosecha')
                .select(`
                    fecha_cosecha,
                    cantidad_kg,
                    variedad_uva ( nombre ),
                    parcela ( productor ( razon_social ) )
                `)
                .order('fecha_cosecha', { ascending: true });

            if (errCosechas) throw errCosechas;

            const porVariedad = {};
            const porProductor = {};
            const porFecha = {};

            (cosechas || []).forEach(c => {
                const kg = Number(c.cantidad_kg) || 0;
                const nomVariedad = c.variedad_uva?.nombre || 'Sin variedad';
                const nomProductor = c.parcela?.productor?.razon_social || 'Sin productor';
                const fecha = c.fecha_cosecha || 'Sin fecha';

                porVariedad[nomVariedad] = (porVariedad[nomVariedad] || 0) + kg;
                porProductor[nomProductor] = (porProductor[nomProductor] || 0) + kg;
                porFecha[fecha] = (porFecha[fecha] || 0) + kg;
            });

            renderChart('chartVariedades', 'doughnut', Object.keys(porVariedad), Object.values(porVariedad), 'Kilogramos');
            renderChart('chartProductores', 'bar', Object.keys(porProductor), Object.values(porProductor), 'Producción (kg)');
            renderChart('chartFechas', 'line', Object.keys(porFecha), Object.values(porFecha), 'Cosecha por Fecha (kg)');

            // Productos registrados por tipo_producto
            const { data: productos, error: errProd } = await db
                .from('producto')
                .select('tipo_producto');

            if (errProd) throw errProd;

            const porTipo = {};
            (productos || []).forEach(p => {
                const tipo = p.tipo_producto || 'Otro';
                porTipo[tipo] = (porTipo[tipo] || 0) + 1;
            });

            renderChart('chartProductos', 'bar', Object.keys(porTipo), Object.values(porTipo), 'Cantidad de Productos');

        } catch (err) {
            console.error('Error generando gráficos:', err.message);
            window.mostrarNotificacion('Error al cargar estadísticas: ' + err.message, 'error');
        }
    }

    function renderChart(canvasId, type, labels, dataValues, labelDataset) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        new Chart(ctx, {
            type: type,
            data: {
                labels: labels.length ? labels : ['Sin datos'],
                datasets: [{
                    label: labelDataset,
                    data: dataValues.length ? dataValues : [0],
                    backgroundColor: paletaPisco,
                    borderColor: '#5B1725',
                    borderWidth: type === 'line' ? 2 : 1,
                    tension: 0.3,
                    fill: type === 'line' ? false : true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: type === 'doughnut',
                        position: 'bottom'
                    }
                },
                scales: type === 'doughnut' ? {} : {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    await cargarContadores();
    await cargarGraficos();
});