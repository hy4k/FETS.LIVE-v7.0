// Supabase Edge Function: GBP Proxy
// Handles all Google Business Profile API calls server-side
// Deployed at: /functions/v1/gbp-proxy

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ── API Base URLs ──────────────────────────────────────────────────────────
const GBP_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const GBP_REVIEWS_BASE = 'https://mybusiness.googleapis.com/v4'
const GBP_POSTS_BASE = 'https://mybusiness.googleapis.com/v4'
const GBP_QA_BASE = 'https://mybusinessqanda.googleapis.com/v1'
const GBP_PERFORMANCE_BASE = 'https://businessprofileperformance.googleapis.com/v1'

// ── Location IDs from Supabase Secrets ────────────────────────────────────
const LOCATIONS: Record<string, string> = {
  cochin: Deno.env.get('GBP_LOCATION_COCHIN') ?? '',
  calicut: Deno.env.get('GBP_LOCATION_CALICUT') ?? '',
}

// ── OAuth Credentials from Supabase Secrets ───────────────────────────────
const CLIENT_ID = Deno.env.get('GBP_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GBP_CLIENT_SECRET') ?? ''
const REFRESH_TOKEN = Deno.env.get('GBP_REFRESH_TOKEN') ?? ''

// ── CORS Headers ──────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// ── Get OAuth2 access token from refresh token ────────────────────────────
async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`)
  }
  return data.access_token
}

// ── Authenticated GBP API fetch ───────────────────────────────────────────
async function gbpFetch(url: string, options: RequestInit = {}) {
  const token = await getAccessToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  const data = await res.json()
  return { data, status: res.status }
}

// ── Main Handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const branch = (url.searchParams.get('branch') ?? 'cochin') as 'cochin' | 'calicut'
    const locationName = LOCATIONS[branch]

    if (!locationName && action !== 'get-oauth-url') {
      return new Response(
        JSON.stringify({ error: `Location ID for '${branch}' not configured.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result: { data: unknown; status: number }

    switch (action) {

      case 'get-location': {
        result = await gbpFetch(
          `${GBP_BASE}/${locationName}?readMask=name,title,phoneNumbers,regularHours,websiteUri,profile,categories`
        )
        break
      }

      case 'list-reviews': {
        const pageToken = url.searchParams.get('pageToken') ?? ''
        const pageSize = url.searchParams.get('pageSize') ?? '20'
        let reviewsUrl = `${GBP_REVIEWS_BASE}/${locationName}/reviews?pageSize=${pageSize}`
        if (pageToken) reviewsUrl += `&pageToken=${pageToken}`
        result = await gbpFetch(reviewsUrl)
        break
      }

      case 'reply-to-review': {
        const body = await req.json()
        result = await gbpFetch(
          `${GBP_REVIEWS_BASE}/${body.reviewName}/reply`,
          { method: 'PUT', body: JSON.stringify({ comment: body.comment }) }
        )
        break
      }

      case 'delete-reply': {
        const body = await req.json()
        result = await gbpFetch(
          `${GBP_REVIEWS_BASE}/${body.reviewName}/reply`,
          { method: 'DELETE' }
        )
        break
      }

      case 'list-posts': {
        result = await gbpFetch(`${GBP_POSTS_BASE}/${locationName}/localPosts`)
        break
      }

      case 'create-post': {
        const body = await req.json()
        result = await gbpFetch(
          `${GBP_POSTS_BASE}/${locationName}/localPosts`,
          { method: 'POST', body: JSON.stringify(body.post) }
        )
        break
      }

      case 'delete-post': {
        const body = await req.json()
        result = await gbpFetch(`${GBP_POSTS_BASE}/${body.postName}`, { method: 'DELETE' })
        break
      }

      case 'list-questions': {
        result = await gbpFetch(`${GBP_QA_BASE}/${locationName}/questions?pageSize=20`)
        break
      }

      case 'answer-question': {
        const body = await req.json()
        result = await gbpFetch(
          `${GBP_QA_BASE}/${body.questionName}/answers`,
          { method: 'POST', body: JSON.stringify({ text: body.text }) }
        )
        break
      }

      case 'get-insights': {
        const startDate = url.searchParams.get('startDate') ?? getDateDaysAgo(28)
        const endDate = url.searchParams.get('endDate') ?? getTodayDate()
        const metrics = [
          'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
          'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
          'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
          'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
          'CALL_CLICKS',
          'DIRECTION_REQUESTS',
          'WEBSITE_CLICKS',
        ]
        const params = new URLSearchParams({
          'dailyRange.startDate.year': startDate.split('-')[0],
          'dailyRange.startDate.month': startDate.split('-')[1],
          'dailyRange.startDate.day': startDate.split('-')[2],
          'dailyRange.endDate.year': endDate.split('-')[0],
          'dailyRange.endDate.month': endDate.split('-')[1],
          'dailyRange.endDate.day': endDate.split('-')[2],
        })
        metrics.forEach(m => params.append('metrics', m))
        result = await gbpFetch(
          `${GBP_PERFORMANCE_BASE}/${locationName}:getDailyMetricsTimeSeries?${params}`
        )
        break
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify(result.data),
      { status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[gbp-proxy] error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────
function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

function getDateDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}
