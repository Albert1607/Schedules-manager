// Database types matching the schema
export type UserRole = 'pic_ministry' | 'pic_ibadah' | 'volunteer'
export type SwapRequestStatus = 'pending_pic' | 'pending_volunteer' | 'approved' | 'rejected'
export type SwapRequestType = 'swap' | 'replacement'
export type ScheduleStatus = 'scheduled' | 'confirmed' | 'swapped' | 'cancelled'
export type SpecLevelLabel = 'Sangat Baik' | 'Baik' | 'Lumayan' | 'Kurang'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  birth_date: string | null
  role: UserRole
  region_id: string | null
  service_id: string | null // for pic_ibadah: which service they manage
  pic_ibadah_id: string | null // for volunteers: their PIC
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Region {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface Service {
  id: string
  name: string
  description: string | null
  region_id: string | null
  pic_ibadah_id: string | null
  day_of_week: number | null // 0=Sunday, 1=Monday, ...
  time_of_day: string | null // HH:MM
  is_active: boolean
  created_at: string
  updated_at: string
  region?: Region
  pic_ibadah?: Profile
}

export interface SpecificationCategory {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface SpecificationLevel {
  id: string
  category_id: string
  label: string
  description: string | null
  order_index: number
  created_at: string
}

export interface VolunteerSpecification {
  id: string
  volunteer_id: string
  category_id: string
  level_id: string
  set_by: string | null
  updated_at: string
  category?: SpecificationCategory
  level?: SpecificationLevel
}

export interface ServiceSlotTemplate {
  id: string
  service_id: string
  slot_name: string
  required_specifications: { category_id: string; min_level_order: number }[]
  count_needed: number
  created_at: string
}

export interface Schedule {
  id: string
  service_id: string
  slot_template_id: string | null
  volunteer_id: string
  scheduled_date: string
  status: ScheduleStatus
  quarter: string
  notes: string | null
  created_by: string | null
  created_at: string
  service?: Service
  volunteer?: Profile
  slot_template?: ServiceSlotTemplate
}

export interface SwapRequest {
  id: string
  requester_id: string
  target_volunteer_id: string | null
  schedule_id: string
  replacement_schedule_id: string | null
  type: SwapRequestType
  status: SwapRequestStatus
  pic_ibadah_id: string | null
  reason: string | null
  pic_note: string | null
  created_at: string
  updated_at: string
  requester?: Profile
  target_volunteer?: Profile
  schedule?: Schedule
  replacement_schedule?: Schedule
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  is_read: boolean
  type: string
  ref_id: string | null
  created_at: string
}

// Supabase Database type (simplified)
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      regions: { Row: Region; Insert: Partial<Region>; Update: Partial<Region> }
      services: { Row: Service; Insert: Partial<Service>; Update: Partial<Service> }
      specification_categories: { Row: SpecificationCategory; Insert: Partial<SpecificationCategory>; Update: Partial<SpecificationCategory> }
      specification_levels: { Row: SpecificationLevel; Insert: Partial<SpecificationLevel>; Update: Partial<SpecificationLevel> }
      volunteer_specifications: { Row: VolunteerSpecification; Insert: Partial<VolunteerSpecification>; Update: Partial<VolunteerSpecification> }
      service_slot_templates: { Row: ServiceSlotTemplate; Insert: Partial<ServiceSlotTemplate>; Update: Partial<ServiceSlotTemplate> }
      schedules: { Row: Schedule; Insert: Partial<Schedule>; Update: Partial<Schedule> }
      swap_requests: { Row: SwapRequest; Insert: Partial<SwapRequest>; Update: Partial<SwapRequest> }
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> }
    }
  }
}
