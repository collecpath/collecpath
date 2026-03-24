import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://trlbazolyajbigfcleib.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRybGJhem9seWFqYmlnZmNsZWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTM1OTIsImV4cCI6MjA4OTkyOTU5Mn0.GHXCWpaY6uA8TYbvTAvLJcKPmSvLOCKpOWPxNEkJKro'
)