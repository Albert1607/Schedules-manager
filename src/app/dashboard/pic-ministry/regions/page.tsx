'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Region } from '@/lib/supabase/types'
import { Plus, Edit2, Trash2, MapPin, Loader2, X } from 'lucide-react'

export default function RegionsPage() {
  const supabase = createClient()
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Region | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('regions').select('*').order('name')
    setRegions((data as Region[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditItem(null)
    setForm({ name: '', description: '' })
    setError('')
    setShowModal(true)
  }

  function openEdit(r: Region) {
    setEditItem(r)
    setForm({ name: r.name, description: r.description || '' })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name) { setError('Nama wilayah wajib diisi'); return }
    setSaving(true)
    setError('')

    const { error: e } = editItem
      ? await supabase.from('regions').update({ name: form.name, description: form.description || null }).eq('id', editItem.id)
      : await supabase.from('regions').insert({ name: form.name, description: form.description || null })

    if (e) { setError(e.message); setSaving(false); return }
    await loadData()
    setShowModal(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus wilayah ini?')) return
    await supabase.from('regions').update({ is_active: false }).eq('id', id)
    loadData()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Kelola Wilayah</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola wilayah pelayanan</p>
        </div>
        <button id="create-region-btn" onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Tambah Wilayah
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {regions.length === 0 ? (
            <div className="col-span-4 glass-card py-16 text-center">
              <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Belum ada wilayah</p>
            </div>
          ) : (
            regions.map(r => (
              <div key={r.id} className="glass-card p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold">{r.name}</h3>
                {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-2 inline-block ${r.is_active ? 'badge-green' : 'badge-red'}`}>
                  {r.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">{editItem ? 'Edit Wilayah' : 'Tambah Wilayah'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-red-400">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nama Wilayah *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="cth: Barat" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Deskripsi</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="form-input" placeholder="Deskripsi singkat..." />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-border">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
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
