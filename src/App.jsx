import { isSupabaseConfigured } from './lib/supabase';
import StudentPage from './pages/StudentPage';
import AdminPage from './pages/AdminPage';

/** Layar panduan jika .env Supabase belum diisi. */
function ConfigGuide() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-2xl space-y-4 rounded-2xl bg-slate-900 p-6 ring-1 ring-amber-500/40">
        <h1 className="text-2xl font-black">🦈 Konfigurasi Supabase Belum Lengkap</h1>
        <p className="text-slate-300">Aplikasi belum bisa terhubung ke database. Ikuti langkah berikut:</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>Buat proyek gratis di <b>supabase.com</b>.</li>
          <li>Buka <b>SQL Editor</b>, tempel isi file <code className="rounded bg-slate-800 px-1">supabase/schema.sql</code>, lalu klik <b>Run</b>.</li>
          <li>Buka <b>Project Settings → API</b>, salin <b>Project URL</b> dan <b>anon public key</b>.</li>
          <li>
            Buat file <code className="rounded bg-slate-800 px-1">.env</code> di folder proyek (sejajar <code>package.json</code>):
            <pre className="mt-2 overflow-x-auto rounded-lg bg-black p-3 text-xs text-emerald-300">{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_ADMIN_PASSWORD=guru123`}</pre>
          </li>
          <li>Hentikan lalu jalankan ulang <code className="rounded bg-slate-800 px-1">npm run dev</code> (atau atur Environment Variables di Vercel/Netlify lalu redeploy).</li>
        </ol>
      </div>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigGuide />;
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  if (path === '/admin') return <AdminPage />;
  return <StudentPage />;
}
