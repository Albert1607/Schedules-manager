import type { Profile, ServiceSlotTemplate, VolunteerSpecification } from './supabase/types'

export interface ScheduleEntry {
  volunteer_id: string
  service_id: string
  slot_template_id: string
  scheduled_date: string
  quarter: string
  status: 'scheduled'
}

interface GenerateOptions {
  serviceId: string
  quarter: string  // e.g. "2026-Q3"
  startDate: Date
  endDate: Date
  slots: ServiceSlotTemplate[]
  volunteers: Profile[]
  volunteerSpecs: VolunteerSpecification[]
  serviceDayOfWeek: number  // 0-6
  extraDates?: string[]     // additional service dates outside regular schedule
}

export function generateSchedule(options: GenerateOptions): ScheduleEntry[] {
  const { serviceId, quarter, startDate, endDate, slots, volunteers, volunteerSpecs, serviceDayOfWeek, extraDates = [] } = options

  // Build service dates
  const serviceDates = getServiceDates(startDate, endDate, serviceDayOfWeek)
  const allDates = [...new Set([...serviceDates, ...extraDates])].sort()

  const entries: ScheduleEntry[] = []

  // Track how many times each volunteer has been scheduled (for fairness)
  const volunteerCount: Record<string, number> = {}
  volunteers.forEach(v => { volunteerCount[v.id] = 0 })

  // Track which volunteers are scheduled per date (no double-booking)
  const dateAssignments: Record<string, Set<string>> = {}
  allDates.forEach(d => { dateAssignments[d] = new Set() })

  for (const date of allDates) {
    for (const slot of slots) {
      const count = slot.count_needed || 1

      for (let i = 0; i < count; i++) {
        // Find eligible volunteers
        const eligible = volunteers.filter(v => {
          if (!v.is_active) return false
          if (dateAssignments[date].has(v.id)) return false // already scheduled today

          // Check spec requirements
          const reqSpecs = slot.required_specifications || []
          if (reqSpecs.length === 0) return true

          return reqSpecs.every((req: { category_id: string; min_level_order: number }) => {
            const spec = volunteerSpecs.find(
              s => s.volunteer_id === v.id && s.category_id === req.category_id
            )
            if (!spec) return false
            // We need the level's order_index — assume it's joined or pre-fetched
            const levelOrder = (spec as any).level?.order_index ?? (spec as any).specification_levels?.order_index ?? 0
            return levelOrder >= req.min_level_order
          })
        })

        if (eligible.length === 0) continue

        eligible.sort((a, b) => {
          const diff = volunteerCount[a.id] - volunteerCount[b.id]
          if (diff !== 0) return diff
          return Math.random() - 0.5
        })

        const chosen = eligible[0]
        volunteerCount[chosen.id]++
        dateAssignments[date].add(chosen.id)

        entries.push({
          volunteer_id: chosen.id,
          service_id: serviceId,
          slot_template_id: slot.id,
          scheduled_date: date,
          quarter,
          status: 'scheduled',
        })
      }
    }
  }

  return entries
}

function getServiceDates(start: Date, end: Date, dayOfWeek: number): string[] {
  const dates: string[] = []
  const current = new Date(start)

  // Move to first occurrence of dayOfWeek
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1)
  }

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 7)
  }

  return dates
}

export function getQuarterBounds(quarter: string): { start: Date; end: Date } {
  const [year, q] = quarter.split('-Q')
  const quarterNum = parseInt(q)
  const yearNum = parseInt(year)

  const quarterStartMonth = (quarterNum - 1) * 3
  const start = new Date(yearNum, quarterStartMonth, 1)
  const end = new Date(yearNum, quarterStartMonth + 3, 0)

  return { start, end }
}

export function getCurrentQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const q = Math.floor(month / 3) + 1
  return `${now.getFullYear()}-Q${q}`
}

export function getQuarterOptions(): { value: string; label: string }[] {
  const now = new Date()
  const year = now.getFullYear()
  const options = []
  for (let y = year; y <= year + 1; y++) {
    for (let q = 1; q <= 4; q++) {
      options.push({ value: `${y}-Q${q}`, label: `${y} Kuartal ${q}` })
    }
  }
  return options
}
