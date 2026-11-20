// js/auth.js
document.addEventListener('DOMContentLoaded', async () => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const inSubfolder = window.location.pathname.includes('/pages/');
    const loginPath = inSubfolder ? '../login.html' : 'login.html';
    const dashboardPath = inSubfolder ? '../dashboard.html' : 'dashboard.html';

    // 1. Verificar sesión actual
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) throw error;

        if (isLoginPage && session) {
            window.location.replace(dashboardPath);
            return;
        }

        if (!isLoginPage && !session) {
            window.location.replace(loginPath);
            return;
        }

        // Mostrar correo del usuario autenticado en el topbar
        if (session) {
            const userEmailEl = document.getElementById('userEmailDisplay');
            if (userEmailEl) userEmailEl.textContent = session.user.email;
        }
    } catch (err) {
        console.error('Error verificando sesión:', err.message);
        if (!isLoginPage) window.location.replace(loginPath);
    }

    // 2. Manejo del formulario de Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const alertBox = document.getElementById('loginAlert');
            const btnLogin = document.getElementById('btnLogin');

            alertBox.classList.add('d-none');

            if (!email || !password) {
                alertBox.textContent = 'Por favor, ingresa tu correo y contraseña.';
                alertBox.classList.remove('d-none');
                return;
            }

            btnLogin.disabled = true;
            btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verificando...';

            try {
                const { error } = await window.supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;
                window.location.replace(dashboardPath);
            } catch (err) {
                alertBox.textContent = 'Credenciales incorrectas o usuario no autorizado: ' + err.message;
                alertBox.classList.remove('d-none');
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Ingresar al Sistema';
            }
        });
    }

    // 3. Manejo del botón Cerrar Sesión
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await window.supabaseClient.auth.signOut();
                window.location.replace(loginPath);
            } catch (err) {
                alert('Error al cerrar sesión: ' + err.message);
            }
        });
    }

    // 4. Toggle de Sidebar en móviles
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (btnToggleSidebar && sidebar && backdrop) {
        btnToggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('show');
            backdrop.classList.toggle('show');
        });
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('show');
            backdrop.classList.remove('show');
        });
    }
});

// Utilidad global para notificaciones Toast
window.mostrarNotificacion = function (mensaje, tipo = 'success') {
    let container = document.querySelector('.toast-container-custom');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container-custom';
        document.body.appendChild(container);
    }

    const bgClass = tipo === 'success' ? 'text-bg-success' : 'text-bg-danger';
    const icon = tipo === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center ${bgClass} border-0 show mb-2`;
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2">
                <i class="bi ${icon}"></i>
                <span>${mensaje}</span>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    container.appendChild(toastEl);
    setTimeout(() => toastEl.remove(), 4000);
};