'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ServiceSlotTemplate, SpecificationCategory, SpecificationLevel } from '@/lib/supabase/types'
import { Plus, Edit2, Trash2, BookOpen, Loader2, X, ChevronDown } from 'lucide-react'

export default function SlotsPage() {
  const supabase = createClient()
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [slots, setSlots] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<ServiceSlotTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    slot_name: '',
    count_needed: '1',
    required_specifications: [] as { category_id: string; min_level_order: number }[],
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('service_id').eq('id', user.id).single()
    const svcId = (profile as any)?.service_id
    setServiceId(svcId)

    if (!svcId) { setLoading(false); return }

    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('service_slot_templates').select('*').eq('service_id', svcId).order('slot_name'),
      supabase.from('specification_categories').select(`*, specification_levels(*)`).eq('is_active', true).order('name'),
    ])
    setSlots(s || [])
    setCategories((c || []).map((cat: any) => ({
      ...cat,
      specification_levels: (cat.specification_levels || []).sort((a: any, b: any) => b.order_index - a.order_index),
    })))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditItem(null)
    setForm({ slot_name: '', count_needed: '1', required_specifications: [] })
    setError('')
    setShowModal(true)
  }

  function openEdit(slot: any) {
    setEditItem(slot)
    setForm({
      slot_name: slot.slot_name,
      count_needed: String(slot.count_needed),
      required_specifications: slot.required_specifications || [],
    })
    setError('')
    setShowModal(true)
  }

  function updateSpecReq(catId: string, minOrder: number | null) {
    setForm(prev => {
      const filtered = prev.required_specifications.filter(r => r.category_id !== catId)
      if (minOrder === null) return { ...prev, required_specifications: filtered }
      return { ...prev, required_specifications: [...filtered, { category_id: catId, min_level_order: minOrder }] }
    })
  }

  async function handleSave() {
    if (!form.slot_name) { setError('Nama slot wajib diisi'); return }
    if (!serviceId) { setError('Ibadah belum ditetapkan'); return }
    setSaving(true)
    setError('')

    const payload = {
      service_id: serviceId,
      slot_name: form.slot_name,
      count_needed: parseInt(form.count_needed) || 1,
      required_specifications: form.required_specifications,
    }

    const { error: e } = editItem
      ? await supabase.from('service_slot_templates').update(payload).eq('id', editItem.id)
      : await supabase.from('service_slot_templates').insert(payload)

    if (e) { setError(e.message); setSaving(false); return }
    await loadData()
    setShowModal(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus slot ini?')) return
    await supabase.from('service_slot_templates').delete().eq('id', id)
    loadData()
  }

  function getCategoryName(catId: string) {
    return categories.find(c => c.id === catId)?.name || catId
  }

  function getLevelLabel(catId: string, minOrder: number) {
    const cat = categories.find(c => c.id === catId)
    const level = cat?.specification_levels?.find((l: any) => l.order_index === minOrder)
    return level?.label || `Level ${minOrder}`
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Template Slot Pelayanan</h1>
          <p className="text-sm text-muted-foreground mt-1">Atur peran volunteer yang dibutuhkan beserta spesifikasi minimalnya</p>
        </div>
        <button id="create-slot-btn" onClick={openCreate} disabled={!serviceId} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Tambah Slot
        </button>
      </div>

      {!serviceId && (
        <div className="glass-card p-6 text-center">
          <p className="text-muted-foreground">Ibadah belum ditetapkan untuk akun Anda. Hubungi PIC Ministry.</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {slots.length === 0 && serviceId ? (
            <div className="col-span-3 glass-card py-16 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Belum ada template slot</p>
              <button onClick={openCreate} className="mt-4 btn-primary text-sm">Buat Template Pertama</button>
            </div>
          ) : (
            slots.map(slot => (
              <div key={slot.id} className="glass-card p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{slot.slot_name}</h3>
                      <p className="text-xs text-muted-foreground">Butuh {slot.count_needed} orang</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(slot)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(slot.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {slot.required_specifications?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Spesifikasi Minimal</p>
                    <div className="space-y-1">
                      {slot.required_specifications.map((req: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{getCategoryName(req.category_id)}</span>
                          <span className="font-medium text-primary">{getLevelLabel(req.category_id, req.min_level_order)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!slot.required_specifications || slot.required_specifications.length === 0) && (
                  <p className="text-xs text-muted-foreground">Tidak ada persyaratan spesifikasi</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">{editItem ? 'Edit Slot' : 'Tambah Slot Baru'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
              {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-red-400">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nama Slot / Peran *</label>
                <input type="text" value={form.slot_name} onChange={e => setForm(f => ({ ...f, slot_name: e.target.value }))} className="form-input" placeholder="cth: Host 1, Singer, Multimedia" />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Jumlah Orang Dibutuhkan</label>
                <input type="number" min="1" max="10" value={form.count_needed} onChange={e => setForm(f => ({ ...f, count_needed: e.target.value }))} className="form-input" />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-3">Spesifikasi Minimal</label>
                <div className="space-y-3">
                  {categories.map((cat: any) => {
                    const existing = form.required_specifications.find(r => r.category_id === cat.id)
                    return (
                      <div key={cat.id} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-32 flex-shrink-0">{cat.name}</span>
                        <select
                          value={existing ? String(existing.min_level_order) : ''}
                          onChange={e => updateSpecReq(cat.id, e.target.value ? parseInt(e.target.value) : null)}
                          className="form-input flex-1"
                        >
                          <option value="">Tidak ada persyaratan</option>
                          {cat.specification_levels.map((level: SpecificationLevel) => (
                            <option key={level.id} value={level.order_index}>Min. {level.label}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-border">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Menyimpan...' : 'Simpan Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
