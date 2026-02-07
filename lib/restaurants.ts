import type { Restaurant } from '../types';
import { supabase } from './supabase';

const getSupabaseUrl = () => process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export async function fetchRestaurants(
  lat: number,
  lng: number,
  radius = 3000
): Promise<Restaurant[]> {
  const url = `${getSupabaseUrl()}/functions/v1/get-restaurants`;
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token && {
        Authorization: `Bearer ${session.access_token}`,
      }),
    },
    body: JSON.stringify({ lat, lng, radius }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to fetch restaurants');
  }

  const { restaurants } = await response.json();
  return restaurants ?? [];
}

export async function recordInteraction(
  placeId: string,
  action: 'like' | 'skip' | 'unlike',
  timeSpentMs: number
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  await supabase.from('restaurant_interactions').insert({
    user_id: session.user.id,
    place_id: placeId,
    action,
    time_spent_ms: timeSpentMs,
  });
}
