'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, SpecificationCategory, SpecificationLevel, VolunteerSpecification } from '@/lib/supabase/types'
import { Users, Star, Edit2, ChevronDown, ChevronUp, Search, Loader2, X, Save, Plus } from 'lucide-react'

export default function VolunteersPage() {
  const supabase = createClient()
  const [volunteers, setVolunteers] = useState<Profile[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [specs, setSpecs] = useState<VolunteerSpecification[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedVolunteer, setSelectedVolunteer] = useState<Profile | null>(null)
  const [editSpecs, setEditSpecs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', phone: '', birth_date: '' })
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const [{ data: v }, { data: c }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').eq('pic_ibadah_id', user.id).eq('is_active', true).order('full_name'),
      supabase.from('specification_categories').select(`*, specification_levels(*)`).eq('is_active', true).order('name'),
      supabase.from('volunteer_specifications').select(`
        *, 
        specification_levels(id, label, order_index, description)
      `),
    ])
    setVolunteers((v as Profile[]) || [])
    setCategories((c || []).map((cat: any) => ({
      ...cat,
      specification_levels: (cat.specification_levels || []).sort((a: any, b: any) => b.order_index - a.order_index),
    })))
    setSpecs((s as VolunteerSpecification[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function getVolunteerSpec(volunteerId: string, categoryId: string) {
    return specs.find(s => s.volunteer_id === volunteerId && s.category_id === categoryId)
  }

  function openEditSpecs(volunteer: Profile) {
    setSelectedVolunteer(volunteer)
    const initial: Record<string, string> = {}
    categories.forEach((cat: any) => {
      const spec = getVolunteerSpec(volunteer.id, cat.id)
      initial[cat.id] = spec?.level_id || ''
    })
    setEditSpecs(initial)
  }

  async function saveSpecs() {
    if (!selectedVolunteer) return
    setSaving(true)

    for (const [catId, levelId] of Object.entries(editSpecs)) {
      if (!levelId) continue
      const existing = getVolunteerSpec(selectedVolunteer.id, catId)
      if (existing) {
        await supabase.from('volunteer_specifications').update({
          level_id: levelId, set_by: currentUserId, updated_at: new Date().toISOString()
        }).eq('id', existing.id)
      } else {
        await supabase.from('volunteer_specifications').insert({
          volunteer_id: selectedVolunteer.id,
          category_id: catId,
          level_id: levelId,
          set_by: currentUserId,
        })
      }
    }

    await loadData()
    setSelectedVolunteer(null)
    setSaving(false)
  }

  async function handleAddVolunteer(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          role: 'volunteer',
          pic_ibadah_id: currentUserId
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan volunteer')
      
      await loadData()
      setShowAddModal(false)
      setFormData({ full_name: '', email: '', password: '', phone: '', birth_date: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = volunteers.filter(v =>
    v.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const levelColor = (order: number) => {
    if (order >= 4) return 'level-sangat-baik'
    if (order >= 3) return 'level-baik'
    if (order >= 2) return 'level-lumayan'
    return 'level-kurang'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Volunteer Saya</h1>
          <p className="text-sm text-muted-foreground mt-1">Lihat dan atur spesifikasi volunteer</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="text-sm text-muted-foreground hidden sm:block">{volunteers.length} volunteer</div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 text-sm px-4 py-2">
            <Plus className="w-4 h-4" /> Tambah Volunteer
          </button>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Cari volunteer..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="glass-card py-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Tidak ada volunteer ditemukan</p>
            </div>
          ) : (
            filtered.map(volunteer => {
              const volSpecs = specs.filter(s => s.volunteer_id === volunteer.id)
              return (
                <div key={volunteer.id} className="glass-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                        {volunteer.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{volunteer.full_name}</p>
                        <p className="text-xs text-muted-foreground">{volunteer.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openEditSpecs(volunteer)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 px-3 py-1.5 border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                    >
                      <Star className="w-3 h-3" /> Edit Spesifikasi
                    </button>
                  </div>

                  {volSpecs.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {categories.map((cat: any) => {
                        const spec = getVolunteerSpec(volunteer.id, cat.id)
                        const level = spec ? (spec as any).specification_levels : null
                        return (
                          <div key={cat.id} className="bg-secondary/40 rounded-lg p-2.5">
                            <p className="text-[10px] text-muted-foreground mb-1 truncate">{cat.name}</p>
                            {level ? (
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${levelColor(level.order_index)}`}>
                                {level.label}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/50">Belum diset</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {volSpecs.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-3">Spesifikasi belum diisi</p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Edit Specs Modal */}
      {selectedVolunteer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">Edit Spesifikasi</h2>
                <p className="text-sm text-muted-foreground">{selectedVolunteer.full_name}</p>
              </div>
              <button onClick={() => setSelectedVolunteer(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {categories.map((cat: any) => (
                <div key={cat.id}>
                  <label className="block text-sm font-medium mb-1.5">
                    {cat.name}
                    {cat.description && <span className="text-xs text-muted-foreground ml-2">— {cat.description}</span>}
                  </label>
                  <select
                    value={editSpecs[cat.id] || ''}
                    onChange={e => setEditSpecs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                    className="form-input"
                  >
                    <option value="">Pilih Level</option>
                    {cat.specification_levels.map((level: SpecificationLevel) => (
                      <option key={level.id} value={level.id}>
                        {level.label} {level.description ? `— ${level.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-6 border-t border-border">
              <button onClick={() => setSelectedVolunteer(null)} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm">Batal</button>
              <button onClick={saveSpecs} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Menyimpan...' : 'Simpan Spesifikasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Volunteer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">Tambah Volunteer Baru</h2>
                <p className="text-sm text-muted-foreground">Volunteer otomatis masuk di bawah Anda</p>
              </div>
              <button onClick={() => setShowAddModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleAddVolunteer} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-500/10 text-red-500 text-sm rounded-lg border border-red-500/20">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1.5">Nama Lengkap</label>
                <input required type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="form-input" placeholder="Misal: John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="form-input" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Password</label>
                <input required type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="form-input" placeholder="Minimal 6 karakter" minLength={6} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Nomor HP <span className="text-xs text-muted-foreground font-normal">(Opsional)</span></label>
                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="form-input" placeholder="08123456789" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Tanggal Lahir <span className="text-xs text-muted-foreground font-normal">(Opsional)</span></label>
                <input type="date" value={formData.birth_date} onChange={e => setFormData({ ...formData, birth_date: e.target.value })} className="form-input" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-secondary hover:bg-accent border border-border rounded-lg text-sm">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Menyimpan...' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
