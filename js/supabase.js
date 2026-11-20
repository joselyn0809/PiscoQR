// js/supabase.js
const SUPABASE_URL = 'https://pfmfnjmrgpuunenmmxis.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_O0y9iaMCm9NDKjYk60cmSg__IoTZpqF';

if (typeof window.supabase === 'undefined') {
    console.error('Error crítico: La librería de Supabase no se cargó desde el CDN.');
} else {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}