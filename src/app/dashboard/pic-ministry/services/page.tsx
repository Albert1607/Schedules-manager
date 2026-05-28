'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Service, Region, Profile } from '@/lib/supabase/types'
import { Plus, Edit2, Trash2, Church, Loader2, X, Calendar } from 'lucide-react'

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export default function ServicesPage() {
  const supabase = createClient()
  const [services, setServices] = useState<any[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [picList, setPicList] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', description: '', region_id: '', pic_ibadah_id: '',
    day_of_week: '0', time_of_day: '08:00',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: r }, { data: p }] = await Promise.all([
      supabase.from('services').select(`
        *, 
        regions(name), 
        profiles!services_pic_ibadah_id_fkey(full_name)
      `).order('name'),
      supabase.from('regions').select('*').eq('is_active', true),
      supabase.from('profiles').select('id, full_name').eq('role', 'pic_ibadah').eq('is_active', true),
    ])
    setServices(s || [])
    setRegions(r as Region[] || [])
    setPicList(p as Profile[] || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditItem(null)
    setForm({ name: '', description: '', region_id: '', pic_ibadah_id: '', day_of_week: '0', time_of_day: '08:00' })
    setError('')
    setShowModal(true)
  }

  function openEdit(s: any) {
    setEditItem(s)
    setForm({
      name: s.name,
      description: s.description || '',
      region_id: s.region_id || '',
      pic_ibadah_id: s.pic_ibadah_id || '',
      day_of_week: String(s.day_of_week ?? 0),
      time_of_day: s.time_of_day || '08:00',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name) { setError('Nama ibadah wajib diisi'); return }
    setSaving(true)
    setError('')

    const payload = {
      name: form.name,
      description: form.description || null,
      region_id: form.region_id || null,
      pic_ibadah_id: form.pic_ibadah_id || null,
      day_of_week: parseInt(form.day_of_week),
      time_of_day: form.time_of_day || null,
    }

    const { error: e } = editItem
      ? await supabase.from('services').update(payload).eq('id', editItem.id)
      : await supabase.from('services').insert(payload)

    if (e) { setError(e.message); setSaving(false); return }

    // Update pic_ibadah's service_id
    if (form.pic_ibadah_id && !editItem) {
      // We need to get the new service id
      const { data: newService } = await supabase.from('services').select('id').eq('name', form.name).order('created_at', { ascending: false }).limit(1).single()
      if (newService) {
        await supabase.from('profiles').update({ service_id: newService.id }).eq('id', form.pic_ibadah_id)
      }
    }

    await loadData()
    setShowModal(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus ibadah ini?')) return
    await supabase.from('services').update({ is_active: false }).eq('id', id)
    loadData()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Kelola Ibadah</h1>
          <p className="text-sm text-muted-foreground mt-1">Tambah dan kelola semua jenis ibadah</p>
        </div>
        <button id="create-service-btn" onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Tambah Ibadah
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.length === 0 ? (
            <div className="col-span-3 glass-card py-16 text-center">
              <Church className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Belum ada ibadah terdaftar</p>
              <button onClick={openCreate} className="mt-4 btn-primary text-sm">Tambah Ibadah Pertama</button>
            </div>
          ) : (
            services.map(s => (
              <div key={s.id} className="glass-card p-5 relative group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${s.is_active ? 'bg-green-500/15' : 'bg-secondary'} flex items-center justify-center`}>
                      <Church className={`w-5 h-5 ${s.is_active ? 'text-green-400' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{s.name}</h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.is_active ? 'badge-green' : 'badge-red'}`}>
                        {s.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(s)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {s.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.description}</p>}

                <div className="space-y-1.5">
                  <InfoRow label="Wilayah" value={s.regions?.name || '—'} />
                  <InfoRow label="PIC" value={s.profiles?.full_name || '—'} />
                  <InfoRow label="Hari" value={DAYS[s.day_of_week ?? 0]} />
                  <InfoRow label="Jam" value={s.time_of_day ? s.time_of_day.slice(0, 5) : '—'} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">{editItem ? 'Edit Ibadah' : 'Tambah Ibadah Baru'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-red-400">{error}</div>}

              <div><label className="form-label">Nama Ibadah *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="cth: Ibadah Minggu Pagi" /></div>

              <div><label className="form-label">Deskripsi</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="form-input" rows={2} placeholder="Deskripsi singkat..." /></div>

              <div><label className="form-label">Wilayah</label>
                <select value={form.region_id} onChange={e => setForm(f => ({ ...f, region_id: e.target.value }))} className="form-input">
                  <option value="">Pilih Wilayah</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div><label className="form-label">PIC Ibadah</label>
                <select value={form.pic_ibadah_id} onChange={e => setForm(f => ({ ...f, pic_ibadah_id: e.target.value }))} className="form-input">
                  <option value="">Pilih PIC Ibadah</option>
                  {picList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Hari</label>
                  <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))} className="form-input">
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Jam Mulai</label>
                  <input type="time" value={form.time_of_day} onChange={e => setForm(f => ({ ...f, time_of_day: e.target.value }))} className="form-input" /></div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-border">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm">Batal</button>
              <button id="save-service-btn" onClick={handleSave} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
