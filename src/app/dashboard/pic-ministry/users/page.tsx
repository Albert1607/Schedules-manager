'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Region, Service } from '@/lib/supabase/types'
import {
  Plus, Search, Edit2, Trash2, MoreVertical, UserCheck,
  Users, Shield, Church, Filter, Loader2, X, Eye, EyeOff
} from 'lucide-react'

const ROLES = [
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'pic_ibadah', label: 'PIC Ibadah' },
  { value: 'pic_ministry', label: 'PIC Ministry' },
]

export default function UsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '', birth_date: '',
    role: 'volunteer', region_id: '', service_id: '', pic_ibadah_id: '',
  })
  const [showPass, setShowPass] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: u }, { data: r }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('regions').select('*').eq('is_active', true),
      supabase.from('services').select('*').eq('is_active', true),
    ])
    setUsers((u as Profile[]) || [])
    setRegions((r as Region[]) || [])
    setServices((s as Service[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = users.filter(u => {
    const matchSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const picIbadahList = users.filter(u => u.role === 'pic_ibadah')

  function openCreate() {
    setEditUser(null)
    setForm({ email: '', password: '', full_name: '', phone: '', birth_date: '', role: 'volunteer', region_id: '', service_id: '', pic_ibadah_id: '' })
    setError('')
    setShowModal(true)
  }

  function openEdit(user: Profile) {
    setEditUser(user)
    setForm({
      email: user.email,
      password: '',
      full_name: user.full_name,
      phone: user.phone || '',
      birth_date: user.birth_date || '',
      role: user.role,
      region_id: user.region_id || '',
      service_id: user.service_id || '',
      pic_ibadah_id: user.pic_ibadah_id || '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    try {
      if (editUser) {
        // Update existing user
        const { error: profileErr } = await supabase.from('profiles').update({
          full_name: form.full_name,
          phone: form.phone || null,
          birth_date: form.birth_date || null,
          role: form.role as Profile['role'],
          region_id: form.region_id || null,
          service_id: form.service_id || null,
          pic_ibadah_id: form.pic_ibadah_id || null,
        }).eq('id', editUser.id)
        if (profileErr) throw profileErr
      } else {
        // Create new user via API
        const res = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Gagal membuat user')
      }

      await loadData()
      setShowModal(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('Yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.')) return
    setDeleting(userId)
    await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    await loadData()
    setDeleting(null)
  }

  async function toggleActive(user: Profile) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    loadData()
  }

  const roleColors: Record<string, string> = {
    pic_ministry: 'badge-purple', pic_ibadah: 'badge-blue', volunteer: 'badge-green',
  }
  const roleLabels: Record<string, string> = {
    pic_ministry: 'PIC Ministry', pic_ibadah: 'PIC Ibadah', volunteer: 'Volunteer',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Kelola Pengguna</h1>
          <p className="text-sm text-muted-foreground mt-1">Buat dan kelola akun volunteer & PIC</p>
        </div>
        <button id="create-user-btn" onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" />
          Tambah User
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">Semua Role</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead className="bg-secondary/50">
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      Tidak ada pengguna ditemukan
                    </td>
                  </tr>
                ) : (
                  filtered.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                            {user.full_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-medium">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="text-muted-foreground">{user.email}</td>
                      <td>
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${roleColors[user.role]}`}>
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td>
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${user.is_active ? 'badge-green' : 'badge-red'}`}>
                          {user.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleActive(user)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                            title={user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(user)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={deleting === user.id}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          >
                            {deleting === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">{editUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <FormField label="Nama Lengkap" required>
                <input
                  type="text" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Nama lengkap" className="form-input"
                />
              </FormField>

              {!editUser && (
                <>
                  <FormField label="Email" required>
                    <input
                      type="email" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@contoh.com" className="form-input"
                    />
                  </FormField>
                  <FormField label="Password" required>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'} value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Min. 8 karakter" className="form-input pr-10"
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormField>
                </>
              )}

              <FormField label="No. Telepon">
                <input
                  type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="08xxxxxxxxxx" className="form-input"
                />
              </FormField>

              <FormField label="Tanggal Lahir">
                <input
                  type="date" value={form.birth_date}
                  onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                  className="form-input"
                />
              </FormField>

              <FormField label="Role" required>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="form-input">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </FormField>

              <FormField label="Wilayah">
                <select value={form.region_id} onChange={e => setForm(f => ({ ...f, region_id: e.target.value }))} className="form-input">
                  <option value="">Pilih Wilayah</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </FormField>

              {form.role === 'pic_ibadah' && (
                <FormField label="Ibadah yang Dikelola">
                  <select value={form.service_id} onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))} className="form-input">
                    <option value="">Pilih Ibadah</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </FormField>
              )}

              {form.role === 'volunteer' && (
                <FormField label="PIC Ibadah">
                  <select value={form.pic_ibadah_id} onChange={e => setForm(f => ({ ...f, pic_ibadah_id: e.target.value }))} className="form-input">
                    <option value="">Pilih PIC Ibadah</option>
                    {picIbadahList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </FormField>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-border">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm transition-colors">
                Batal
              </button>
              <button
                id="save-user-btn"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}
