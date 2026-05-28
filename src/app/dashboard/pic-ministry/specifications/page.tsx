'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SpecificationCategory, SpecificationLevel } from '@/lib/supabase/types'
import { Plus, Edit2, Trash2, Star, ChevronDown, ChevronUp, Loader2, X, GripVertical } from 'lucide-react'

export default function SpecificationsPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  // Category modal
  const [showCatModal, setShowCatModal] = useState(false)
  const [editCat, setEditCat] = useState<SpecificationCategory | null>(null)
  const [catForm, setCatForm] = useState({ name: '', description: '' })

  // Level modal
  const [showLevelModal, setShowLevelModal] = useState(false)
  const [editLevel, setEditLevel] = useState<SpecificationLevel | null>(null)
  const [levelCategoryId, setLevelCategoryId] = useState<string>('')
  const [levelForm, setLevelForm] = useState({ label: '', description: '', order_index: '1' })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('specification_categories')
      .select(`*, specification_levels(*)`)
      .eq('is_active', true)
      .order('name')

    const sorted = (data || []).map((cat: any) => ({
      ...cat,
      specification_levels: (cat.specification_levels || []).sort((a: any, b: any) => b.order_index - a.order_index),
    }))
    setCategories(sorted)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Category CRUD
  function openCreateCat() {
    setEditCat(null)
    setCatForm({ name: '', description: '' })
    setError('')
    setShowCatModal(true)
  }

  function openEditCat(cat: SpecificationCategory) {
    setEditCat(cat)
    setCatForm({ name: cat.name, description: cat.description || '' })
    setError('')
    setShowCatModal(true)
  }

  async function saveCat() {
    if (!catForm.name) { setError('Nama wajib diisi'); return }
    setSaving(true)
    setError('')
    const payload = { name: catForm.name, description: catForm.description || null }
    const { error: e } = editCat
      ? await supabase.from('specification_categories').update(payload).eq('id', editCat.id)
      : await supabase.from('specification_categories').insert(payload)
    if (e) { setError(e.message); setSaving(false); return }

    if (!editCat) {
      // Add default 4 levels
      const { data: newCat } = await supabase.from('specification_categories').select('id').eq('name', catForm.name).order('created_at', { ascending: false }).limit(1).single()
      if (newCat) {
        await supabase.from('specification_levels').insert([
          { category_id: newCat.id, label: 'Sangat Baik', description: 'Performa sangat memuaskan dan konsisten', order_index: 4 },
          { category_id: newCat.id, label: 'Baik', description: 'Performa baik dan dapat diandalkan', order_index: 3 },
          { category_id: newCat.id, label: 'Lumayan', description: 'Performa cukup, masih perlu pengembangan', order_index: 2 },
          { category_id: newCat.id, label: 'Kurang', description: 'Perlu bimbingan dan latihan lebih lanjut', order_index: 1 },
        ])
      }
    }

    await loadData()
    setShowCatModal(false)
    setSaving(false)
  }

  async function deleteCat(id: string) {
    if (!confirm('Hapus kategori spesifikasi ini? Semua levelnya juga akan terhapus.')) return
    await supabase.from('specification_categories').update({ is_active: false }).eq('id', id)
    loadData()
  }

  // Level CRUD
  function openCreateLevel(categoryId: string) {
    setEditLevel(null)
    setLevelCategoryId(categoryId)
    setLevelForm({ label: '', description: '', order_index: '1' })
    setError('')
    setShowLevelModal(true)
  }

  function openEditLevel(level: SpecificationLevel) {
    setEditLevel(level)
    setLevelCategoryId(level.category_id)
    setLevelForm({ label: level.label, description: level.description || '', order_index: String(level.order_index) })
    setError('')
    setShowLevelModal(true)
  }

  async function saveLevel() {
    if (!levelForm.label) { setError('Label wajib diisi'); return }
    setSaving(true)
    setError('')
    const payload = {
      category_id: levelCategoryId,
      label: levelForm.label,
      description: levelForm.description || null,
      order_index: parseInt(levelForm.order_index) || 1,
    }
    const { error: e } = editLevel
      ? await supabase.from('specification_levels').update(payload).eq('id', editLevel.id)
      : await supabase.from('specification_levels').insert(payload)
    if (e) { setError(e.message); setSaving(false); return }
    await loadData()
    setShowLevelModal(false)
    setSaving(false)
  }

  async function deleteLevel(id: string) {
    if (!confirm('Hapus level ini?')) return
    await supabase.from('specification_levels').delete().eq('id', id)
    loadData()
  }

  const levelColor = (idx: number) => {
    const colors = ['level-kurang', 'level-lumayan', 'level-baik', 'level-sangat-baik']
    return colors[Math.min(idx - 1, 3)] || 'level-baik'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Kelola Spesifikasi</h1>
          <p className="text-sm text-muted-foreground mt-1">Atur kategori dan level penilaian volunteer</p>
        </div>
        <button id="create-spec-btn" onClick={openCreateCat} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Tambah Kategori
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {categories.length === 0 ? (
            <div className="glass-card py-16 text-center">
              <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Belum ada kategori spesifikasi</p>
            </div>
          ) : (
            categories.map(cat => (
              <div key={cat.id} className="glass-card overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <button onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                    className="flex items-center gap-3 flex-1 text-left">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Star className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{cat.name}</p>
                      {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">{cat.specification_levels.length} level</span>
                    {expandedCat === cat.id ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />}
                  </button>
                  <div className="flex gap-1 ml-4">
                    <button onClick={() => openEditCat(cat)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteCat(cat.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Levels */}
                {expandedCat === cat.id && (
                  <div className="border-t border-border/50 px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Level Penilaian</p>
                      <button onClick={() => openCreateLevel(cat.id)} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Tambah Level
                      </button>
                    </div>
                    <div className="space-y-2">
                      {cat.specification_levels.map((level: SpecificationLevel) => (
                        <div key={level.id} className="flex items-start gap-3 p-3 bg-secondary/40 rounded-lg group">
                          <GripVertical className="w-4 h-4 text-muted-foreground/30 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${levelColor(level.order_index)}`}>
                                {level.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground">#{level.order_index}</span>
                            </div>
                            {level.description && <p className="text-xs text-muted-foreground">{level.description}</p>}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditLevel(level)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteLevel(level.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">{editCat ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
              <button onClick={() => setShowCatModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-red-400">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Nama Kategori *</label>
                <input type="text" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="cth: Intonasi" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Deskripsi</label>
                <textarea value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} className="form-input" rows={2} placeholder="Penjelasan kategori ini..." />
              </div>
              {!editCat && <p className="text-xs text-muted-foreground">4 level default (Sangat Baik, Baik, Lumayan, Kurang) akan dibuat otomatis.</p>}
            </div>
            <div className="flex gap-3 p-6 border-t border-border">
              <button onClick={() => setShowCatModal(false)} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm">Batal</button>
              <button onClick={saveCat} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level Modal */}
      {showLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">{editLevel ? 'Edit Level' : 'Tambah Level'}</h2>
              <button onClick={() => setShowLevelModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-red-400">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Label *</label>
                <input type="text" value={levelForm.label} onChange={e => setLevelForm(f => ({ ...f, label: e.target.value }))} className="form-input" placeholder="cth: Sangat Baik" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Deskripsi</label>
                <textarea value={levelForm.description} onChange={e => setLevelForm(f => ({ ...f, description: e.target.value }))} className="form-input" rows={2} placeholder="Penjelasan level ini..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Urutan (1 = terendah)</label>
                <input type="number" min="1" value={levelForm.order_index} onChange={e => setLevelForm(f => ({ ...f, order_index: e.target.value }))} className="form-input" />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-border">
              <button onClick={() => setShowLevelModal(false)} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm">Batal</button>
              <button onClick={saveLevel} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
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
