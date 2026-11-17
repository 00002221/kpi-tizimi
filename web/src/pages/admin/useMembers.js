import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'

// Kompaniyaning barcha a'zolari (admin uchun)
export default function useMembers() {
  const { company } = useAuth()
  const [members, setMembers] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('company_id', company.id)
      .order('full_name')
    setError(error)
    setMembers(data || [])
  }, [company.id])

  useEffect(() => { load() }, [load])
  return { members, error, reload: load }
}
