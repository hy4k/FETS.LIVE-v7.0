// GBP Service - Frontend API calls to Supabase Edge Function (gbp-proxy)
// All calls go through the edge function to keep credentials server-side

import type {
  GBPBranch,
  GBPLocation,
  GBPReviewsResponse,
  GBPReview,
  GBPLocalPost,
  GBPCreatePostPayload,
  GBPQuestionsResponse,
  GBPInsightsResponse,
  GBPLocationSummary,
} from '../types/gbp.types'

// Hardcoded fallbacks match src/lib/supabase.ts so the frontend keeps working even
// when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing at build time.
// Without these fallbacks the URL became `undefined/functions/v1/gbp-proxy?...` which
// Azure Static Web Apps served as `index.html`, producing the
// "Unexpected token '<', '<!DOCTYPE'... is not valid JSON" runtime error on fets.live.
const FALLBACK_SUPABASE_URL = 'https://qqewusetilxxfvfkmsed.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s'

const EDGE_FUNCTION = 'gbp-proxy'

function getSupabaseUrl(): string {
  const v = import.meta.env.VITE_SUPABASE_URL as string | undefined
  return v && v.trim() ? v : FALLBACK_SUPABASE_URL
}

function getSupabaseAnonKey(): string {
  const v = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  return v && v.trim() ? v : FALLBACK_SUPABASE_ANON_KEY
}

/** Parse a Response body, returning a useful error if the response is HTML
 * (e.g. Azure Static Web Apps fallback `index.html`) instead of JSON. */
async function parseJsonOrThrow(res: Response): Promise<any> {
  const text = await res.text()
  const contentType = res.headers.get('content-type') ?? ''
  const looksLikeHtml = text.trimStart().startsWith('<')

  if (looksLikeHtml || (!contentType.includes('application/json') && !text)) {
    throw new Error(
      `GBP proxy returned non-JSON response (status ${res.status}). ` +
      `This usually means VITE_SUPABASE_URL is missing at build time and the ` +
      `request was served the SPA index.html. URL: ${res.url}`
    )
  }

  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`GBP proxy returned malformed JSON (status ${res.status}): ${text.slice(0, 200)}`)
  }

  if (!res.ok) {
    throw new Error(data?.error ?? `GBP API error ${res.status}`)
  }
  return data
}

/** Direct fetch to the gbp-proxy edge function (action via query string).
 * Edge function reads `action` and `branch` from URL searchParams, NOT from the body. */
async function gbpCall<T>(
  action: string,
  branch: GBPBranch,
  extraParams: Record<string, string> = {},
  body?: unknown,
): Promise<T> {
  const supabaseUrl = getSupabaseUrl()
  const supabaseKey = getSupabaseAnonKey()

  const params = new URLSearchParams({ action, branch, ...extraParams })
  const url = `${supabaseUrl}/functions/v1/${EDGE_FUNCTION}?${params.toString()}`

  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  return (await parseJsonOrThrow(res)) as T
}

// ── Location ──────────────────────────────────────────────────────────────
export const gbpLocationService = {
  async getLocation(branch: GBPBranch): Promise<GBPLocation> {
    return gbpCall<GBPLocation>('get-location', branch)
  },
}

// ── Reviews ───────────────────────────────────────────────────────────────
export const gbpReviewsService = {
  async listReviews(branch: GBPBranch, pageToken?: string, pageSize = 20): Promise<GBPReviewsResponse> {
    const extra: Record<string, string> = { pageSize: String(pageSize) }
    if (pageToken) extra.pageToken = pageToken
    return gbpCall<GBPReviewsResponse>('list-reviews', branch, extra)
  },

  async replyToReview(branch: GBPBranch, reviewName: string, comment: string): Promise<GBPReview> {
    return gbpCall<GBPReview>('reply-to-review', branch, {}, { reviewName, comment })
  },

  async deleteReply(branch: GBPBranch, reviewName: string): Promise<void> {
    return gbpCall<void>('delete-reply', branch, {}, { reviewName })
  },

  /** Get location summary: rating + unreplied count + recent 5 reviews */
  async getLocationSummary(branch: GBPBranch): Promise<GBPLocationSummary> {
    const [reviewsData, location] = await Promise.all([
      gbpReviewsService.listReviews(branch, undefined, 10),
      gbpLocationService.getLocation(branch).catch(() => undefined),
    ])
    const reviews = reviewsData.reviews ?? []
    const unrepliedCount = reviews.filter(r => !r.reviewReply).length
    return {
      branch,
      label: branch === 'cochin' ? 'FETS Cochin' : 'FETS Calicut',
      location,
      reviewCount: reviewsData.totalReviewCount ?? reviews.length,
      averageRating: reviewsData.averageRating ?? 0,
      recentReviews: reviews.slice(0, 5),
      unrepliedCount,
    }
  },
}

// ── Posts ─────────────────────────────────────────────────────────────────
export const gbpPostsService = {
  async listPosts(branch: GBPBranch): Promise<{ localPosts?: GBPLocalPost[] }> {
    return gbpCall('list-posts', branch)
  },

  async createPost(branch: GBPBranch, post: GBPCreatePostPayload): Promise<GBPLocalPost> {
    return gbpCall<GBPLocalPost>('create-post', branch, {}, { post })
  },

  async deletePost(branch: GBPBranch, postName: string): Promise<void> {
    return gbpCall<void>('delete-post', branch, {}, { postName })
  },
}

// ── Q&A ───────────────────────────────────────────────────────────────────
export const gbpQAService = {
  async listQuestions(branch: GBPBranch): Promise<GBPQuestionsResponse> {
    return gbpCall<GBPQuestionsResponse>('list-questions', branch)
  },

  async answerQuestion(branch: GBPBranch, questionName: string, text: string): Promise<void> {
    return gbpCall<void>('answer-question', branch, {}, { questionName, text })
  },
}

// ── Insights ──────────────────────────────────────────────────────────────
export const gbpInsightsService = {
  async getInsights(branch: GBPBranch, startDate?: string, endDate?: string): Promise<GBPInsightsResponse> {
    const extra: Record<string, string> = {}
    if (startDate) extra.startDate = startDate
    if (endDate) extra.endDate = endDate
    return gbpCall<GBPInsightsResponse>('get-insights', branch, extra)
  },
}

// ── OAuth setup helper (admin only) ──────────────────────────────────────────
export const gbpAuthService = {
  async getOAuthUrl(): Promise<string> {
    const supabaseUrl = getSupabaseUrl()
    const supabaseKey = getSupabaseAnonKey()
    const res = await fetch(
      `${supabaseUrl}/functions/v1/${EDGE_FUNCTION}?action=get-oauth-url&branch=cochin`,
      {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      },
    )
    const data = await parseJsonOrThrow(res)
    return data.url as string
  },
}
