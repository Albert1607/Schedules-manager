# Ministry Schedule Manager

Sistem manajemen jadwal pelayanan dengan RBAC (Role-Based Access Control).

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Auth + Database + RLS)
- **Tailwind CSS** (Dark glassmorphism theme)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Setup environment variables
Buka `.env.local` dan isi:
```
NEXT_PUBLIC_SUPABASE_URL=https://yknahwrpdbvqywpebsjp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dari Supabase Dashboard → Settings → API → anon key>
SUPABASE_SERVICE_ROLE_KEY=<dari Supabase Dashboard → Settings → API → service_role key>
```

### 3. Jalankan migrasi database
Buka Supabase Dashboard → SQL Editor → paste konten file:
`supabase/migrations/001_initial_schema.sql`

### 4. Buat akun PIC Ministry pertama
Di Supabase Dashboard → Authentication → Add User:
- Email & password bebas
- Setelah dibuat, di SQL Editor jalankan:
```sql
UPDATE profiles SET role = 'pic_ministry' WHERE email = 'email_kamu@domain.com';
```

### 5. Jalankan dev server
```bash
npm run dev
```
Buka http://localhost:3000

## Roles
| Role | Akses |
|---|---|
| `pic_ministry` | Super admin: kelola semua user, ibadah, wilayah, spesifikasi, lihat semua jadwal |
| `pic_ibadah` | Kelola volunteer di bawahnya, buat jadwal, approve swap |
| `volunteer` | Lihat jadwal sendiri, request swap |

## Fitur Utama
- ✅ RBAC dengan 3 role
- ✅ Manajemen user (create/edit/delete)
- ✅ Manajemen ibadah & wilayah (dinamis)
- ✅ Spesifikasi volunteer dinamis (kategori + level editable)
- ✅ Template slot pelayanan per ibadah
- ✅ Auto-generate jadwal per kuartal (3 bulan)
- ✅ Sistem swap jadwal dengan approval workflow
- ✅ Notifikasi real-time in-app
- ✅ Reminder mingguan dengan WhatsApp quick link
- ✅ Calendar view untuk volunteer
