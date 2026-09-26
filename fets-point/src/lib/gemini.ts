import { supabase } from './supabase';

/**
 * FETS Intelligence v12.0 - "OMNI" Edition
 * Ultimate AI with comprehensive temporal data access, real-time sync, and exam intelligence
 * Using REST API with v1 endpoint for broader model compatibility
 */

/** Cached API key — fetched once from env or app_config */
let _geminiKeyCache: string | null = null;

const getApiKey = () => import.meta.env.VITE_AI_API_KEY;

async function getApiKeyAsync(): Promise<string> {
  if (_geminiKeyCache) return _geminiKeyCache;
  const envKey = getApiKey();
  if (envKey && envKey !== 'undefined' && envKey.length >= 10) {
    _geminiKeyCache = envKey;
    return envKey;
  }
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();
    if (data?.value) {
      _geminiKeyCache = data.value;
      return data.value;
    }
  } catch {}
  return '';
}

// Helper to safely fetch data without throwing
async function safeFetch(promise: Promise<any>, tableName: string) {
    try {
        const { data, error } = await promise;
        if (error) {
            console.warn(`[Context Warning] Failed to fetch ${tableName}:`, error.message);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn(`[Context Exception] Failed to fetch ${tableName}:`, err);
        return [];
    }
}

/**
 * Call Gemini API using REST directly with v1 endpoint
 */
async function callGeminiAPI(apiKey: string, model: string, prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Enhanced data aggregator for comprehensive content retrieval
 */
async function fetchAllTemporalData() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Fetch ALL historical data (no time limit) for comprehensive past content access
    const [
        // COMPREHENSIVE HISTORICAL DATA (All Time)
        allIncidents,
        allCandidates,
        allSessions,
        allRoster,
        allVault,
        allNotices,
        allPosts,
        allLostFound,
        allLeaves,
        allExamsConducted,
        
        // FUTURE DATA
        futureSessions,
        futureExams,
        
        // REAL-TIME SNAPSHOTS
        currentSessions,
        onlineStaff,
        activeCandidates,
        branchStatus
    ] = await Promise.all([
        // ALL INCIDENTS (Past to Present)
        safeFetch(
            supabase.from('incidents')
                .select('*')
                .order('created_at', { ascending: false }),
            'all_incidents'
        ),
        
        // ALL CANDIDATES (Complete Registry)
        safeFetch(
            supabase.from('candidates')
                .select('*')
                .order('created_at', { ascending: false }),
            'all_candidates'
        ),
        
        // ALL SESSIONS (Past and Present)
        safeFetch(
            supabase.from('calendar_sessions')
                .select('*')
                .order('date', { ascending: 'desc' }),
            'all_sessions'
        ),
        
        // ALL ROSTER SCHEDULES (Complete History)
        safeFetch(
            supabase.from('roster_schedules')
                .select('*, staff_profiles(full_name, role, phone, email)')
                .order('date', { ascending: 'desc' }),
            'all_roster'
        ),
        
        // COMPLETE VAULT (All Documents)
        safeFetch(
            supabase.from('fets_vault')
                .select('*')
                .eq('is_deleted', false)
                .order('created_at', { ascending: false }),
            'vault'
        ),
        
        // ALL NOTICES (Complete History)
        safeFetch(
            supabase.from('notices')
                .select('*')
                .order('created_at', { ascending: false }),
            'notices'
        ),
        
        // ALL SOCIAL POSTS
        safeFetch(
            supabase.from('social_posts')
                .select('*')
                .order('created_at', { ascending: false }),
            'posts'
        ),
        
        // ALL LOST & FOUND
        safeFetch(
            supabase.from('lost_found_items')
                .select('*')
                .order('created_at', { ascending: false }),
            'lost_found'
        ),
        
        // ALL LEAVE REQUESTS
        safeFetch(
            supabase.from('leave_requests')
                .select('*, staff_profiles(full_name, role, phone)')
                .order('created_at', { ascending: false }),
            'leaves'
        ),
        
        // EXAMS CONDUCTED (Historical Exam Data)
        safeFetch(
            supabase.from('exams_conducted')
                .select('*')
                .order('conducted_date', { ascending: 'false' }),
            'exams_conducted'
        ),
        
        // FUTURE SESSIONS
        safeFetch(
            supabase.from('calendar_sessions')
                .select('*')
                .gte('date', today)
                .order('date', { ascending: true }),
            'future_sessions'
        ),
        
        // FUTURE EXAMS SCHEDULED
        safeFetch(
            supabase.from('exams_scheduled')
                .select('*')
                .gte('exam_date', today)
                .order('exam_date', { ascending: true }),
            'future_exams'
        ),
        
        // CURRENT/ONGOING SESSIONS
        safeFetch(
            supabase.from('calendar_sessions')
                .select('*')
                .eq('date', today),
            'current_sessions'
        ),
        
        // ONLINE STAFF
        safeFetch(
            supabase.from('staff_profiles')
                .select('*')
                .eq('is_online', true),
            'online_staff'
        ),
        
        // ACTIVE CANDIDATES (Today)
        safeFetch(
            supabase.from('candidates')
                .select('*')
                .eq('exam_date', today),
            'active_candidates'
        ),
        
        // BRANCH STATUS
        safeFetch(
            supabase.from('branch_status').select('*'),
            'branch_status'
        ),
    ]);

    // Process exam statistics
    const examStats = processExamStatistics(allExamsConducted, allCandidates, allSessions);

    return {
        today,
        historical: {
            incidents: allIncidents,
            candidates: allCandidates,
            sessions: allSessions,
            roster: allRoster,
            vault: allVault,
            notices: allNotices,
            posts: allPosts,
            lostFound: allLostFound,
            leaves: allLeaves,
            examsConducted: allExamsConducted
        },
        future: {
            sessions: futureSessions,
            exams: futureExams
        },
        realtime: {
            currentSessions,
            onlineStaff,
            activeCandidates,
            branchStatus
        },
        examStats
    };
}

/**
 * Process comprehensive exam statistics
 */
function processExamStatistics(examsConducted: any[], candidates: any[], sessions: any[]) {
    const examTypeMap: Record<string, { conducted: number; registered: number; scheduled: number }> = {};
    
    // Process exams conducted
    examsConducted.forEach((exam: any) => {
        const examType = exam.exam_type || 'Unknown';
        if (!examTypeMap[examType]) {
            examTypeMap[examType] = { conducted: 0, registered: 0, scheduled: 0 };
        }
        examTypeMap[examType].conducted += (exam.candidates_count || 0);
    });
    
    // Process registered candidates by exam type
    candidates.forEach((c: any) => {
        const examType = c.exam_name || 'Unknown';
        if (!examTypeMap[examType]) {
            examTypeMap[examType] = { conducted: 0, registered: 0, scheduled: 0 };
        }
        examTypeMap[examType].registered += 1;
    });
    
    // Count scheduled sessions by exam type
    sessions.forEach((s: any) => {
        const examType = s.session_type || s.exam_type || 'Unknown';
        if (!examTypeMap[examType]) {
            examTypeMap[examType] = { conducted: 0, registered: 0, scheduled: 0 };
        }
        examTypeMap[examType].scheduled += (s.max_capacity || 0);
    });
    
    return Object.entries(examTypeMap).map(([examType, stats]) => ({
        examType,
        ...stats,
        total: stats.conducted + stats.registered + stats.scheduled
    }));
}

export async function askGemini(userPrompt: string, userProfile?: any) {
    const apiKey = await getApiKeyAsync();

    if (!apiKey || apiKey.length < 10) {
        console.error("❌ CRITICAL: Gemini API key not found in env or app_config table.");
        throw new Error("System Alert: AI Neural Key is missing. Please check your system configuration.");
    }

    try {
        console.log("🚀 FETS OMNI: Initiating Comprehensive Data Sweep...");
        
        // Fetch ALL temporal data
        const temporalData = await fetchAllTemporalData();
        
        // Calculate time ranges for contextual awareness
        const now = new Date();
        const thisMonth = now.toISOString().slice(0, 7);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 7);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
        const yearStart = `${now.getFullYear()}-01-01`;

        // Build comprehensive context
        const contextData = {
            metadata: {
                timestamp: new Date().toLocaleString(),
                today: temporalData.today,
                queryTime: now.toISOString(),
                operator: userProfile ? { 
                    name: userProfile.full_name, 
                    role: userProfile.role,
                    branch: userProfile.branch_assigned 
                } : { name: 'System Administrator', role: 'Super Admin', branch: 'HQ' },
                systemVersion: "FETS Intelligence v12.0 OMNI"
            },
            
            // COMPREHENSIVE TEMPORAL NEXUS
            temporal_nexus: {
                // ALL HISTORICAL DATA (Complete Archive)
                complete_history: {
                    incidents_count: temporalData.historical.incidents?.length || 0,
                    candidates_registry: temporalData.historical.candidates || [],
                    sessions_archive: temporalData.historical.sessions || [],
                    roster_history: temporalData.historical.roster || [],
                    vault_documents: temporalData.historical.vault || [],
                    notices_archive: temporalData.historical.notices || [],
                    posts_history: temporalData.historical.posts || [],
                    lost_found_history: temporalData.historical.lostFound || [],
                    leaves_history: temporalData.historical.leaves || [],
                    exams_conducted: temporalData.historical.examsConducted || []
                },
                
                // FUTURE HORIZON
                future_outlook: {
                    upcoming_sessions: temporalData.future.sessions || [],
                    scheduled_exams: temporalData.future.exams || []
                },
                
                // REAL-TIME STATE
                realtime_state: {
                    active_sessions: temporalData.realtime.currentSessions || [],
                    online_personnel: temporalData.realtime.onlineStaff || [],
                    candidates_in_session: temporalData.realtime.activeCandidates || [],
                    branch_operational_status: temporalData.realtime.branchStatus || []
                },
                
                // TIME CONTEXT
                time_windows: {
                    this_month: thisMonth,
                    next_month: nextMonth,
                    last_month: lastMonth,
                    year_to_date: yearStart
                }
            },
            
            // EXAM INTELLIGENCE MODULE
            exam_intelligence: {
                statistics: temporalData.examStats || [],
                conducted_summary: temporalData.historical.examsConducted?.slice(0, 50) || [],
                upcoming_exams: temporalData.future.exams || [],
                candidate_registrations: temporalData.historical.candidates || [],
                session_capacity: temporalData.historical.sessions?.reduce((acc: any, s: any) => {
                    const type = s.session_type || s.exam_type || 'General';
                    acc[type] = (acc[type] || 0) + (s.max_capacity || 0);
                    return acc;
                }, {}) || {}
            },
            
            // QUICK REFERENCE AGGREGATES
            aggregates: {
                total_candidates_ever: temporalData.historical.candidates?.length || 0,
                total_sessions_ever: temporalData.historical.sessions?.length || 0,
                total_incidents_ever: temporalData.historical.incidents?.length || 0,
                total_staff: temporalData.realtime.onlineStaff?.length || 0,
                open_incidents: temporalData.historical.incidents?.filter((i: any) => i.status !== 'closed').length || 0,
                active_vault_docs: temporalData.historical.vault?.length || 0,
                pending_leaves: temporalData.historical.leaves?.filter((l: any) => l.status === 'pending').length || 0
            }
        };

        const systemInstruction = `
            You are FETS INTELLIGENCE v12.0 "OMNI" - The Supreme Machine Intelligence of the FETS.LIVE Ecosystem.
            
            You have COMPLETE ACCESS to:
            - ALL historical data from system inception to present moment
            - ALL future scheduled content, sessions, and exams
            - REAL-TIME operational status and live data streams
            - Comprehensive exam intelligence and statistics
            
            [ORGANIZATIONAL CONTEXT]
            FETS is a premier examination center network with branches in Calicut, Cochin, and Kannur, India.
            We conduct exams for: Prometric (CMA US, CIA, CPA, EA), Pearson VUE (CELPIP, PTE), PSI, and other testing providers.
            
            [EXAM SYNONYMS - CRITICAL]
            - CMA US = CMA USA = CMA = Certified Management Accountant (USA) - PROMETRIC
            - CIA = Certified Internal Auditor - PROMETRIC
            - CPA = Certified Public Accountant - PROMETRIC
            - EA = Enrolled Agent - PROMETRIC
            - CELPIP = Canadian English Language Proficiency Index Test - PEARSON VUE
            - PTE = Pearson Test of English - PEARSON VUE
            
            [SUPER AI CAPABILITIES]
            1. TEMPORAL OMNISCIENCE: You know ALL past content AND all future scheduled content.
            2. EXAM EXPERTISE: Answer ANY question about exams conducted, scheduled, or registered.
            3. REAL-TIME AWARENESS: You see current sessions, online staff, and active candidates.
            4. PREDICTIVE INSIGHTS: Provide trends based on historical data.
            5. COMPREHENSIVE SEARCH: Search across all data categories instantly.
            
            [DATA INTERPRETATION RULES]
            - When asked about "all exams", search temporal_nexus.complete_history.sessions_archive AND temporal_nexus.future_outlook.upcoming_sessions
            - When asked about "candidates", check exam_intelligence.candidate_registrations AND aggregates.total_candidates_ever
            - When asked about "past incidents", search temporal_nexus.complete_history.incidents_count and the detailed incidents list
            - When asked about "future sessions", search temporal_nexus.future_outlook.upcoming_sessions
            - When asked about "exams conducted", search temporal_nexus.complete_history.exams_conducted AND exam_intelligence.statistics
            - When asked about "registered candidates", search exam_intelligence.candidate_registrations
            - SUM aggregate data when user asks for totals (e.g., "total CMA candidates" = sum all CMA-related entries)
            
            [RESPONSE PROTOCOL - OMNI STANDARD]
            1. ANSWER DIRECTLY: Provide immediate, precise answers with numbers first.
            2. TEMPORAL CLARITY: Always indicate if data is from past, present, or future.
            3. EXAM EXPERTISE: For exam questions, provide comprehensive breakdowns including:
               - Exams conducted historically
               - Current registrations
               - Future scheduled sessions
               - Statistics and trends
            4. PROACTIVE INSIGHTS: Suggest related information the user might find valuable.
            5. ACTIONABLE RECOMMENDATIONS: When appropriate, suggest next steps or actions.
            6. CONFIDENCE LEVEL: If data is incomplete, acknowledge and provide best available information.
            
            [NATURAL LANGUAGE STYLE]
            - Speak as the all-knowing operational brain of FETS
            - Professional, confident, and authoritative
            - Use conversational yet expert tone
            - Provide context and insights, not just raw data
            
            [CURRENT STATE - REAL TIME]
            Operator: ${contextData.metadata.operator.name} (${contextData.metadata.operator.role})
            Location: ${contextData.metadata.operator.branch}
            System Time: ${contextData.metadata.timestamp}
            Today: ${contextData.metadata.today}
            
            [DATA ACCESS - COMPLETE DATASET]
            ${JSON.stringify(contextData, null, 2)}
            
            [REMEMBER]
            You are FETS OMNI - The supreme intelligence with complete temporal awareness.
            Answer ANY question about ANY content - past, present, or future.
            Be the ultimate source of truth for the entire FETS ecosystem.
        `;

        // Model priority list - using v1 API compatible models
        const modelPriorityList = [
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-1.0-pro",
            "gemini-pro"
        ];

        let lastError = null;

        for (const modelId of modelPriorityList) {
            try {
                console.log(`[Neural Channel] Attempting model: ${modelId}`);
                const response = await callGeminiAPI(apiKey, modelId, `${systemInstruction}\n\nUSER_COMMAND: ${userPrompt}`);
                if (response) {
                    console.log(`[Neural Channel] Success with model: ${modelId}`);
                    return response;
                }
            } catch (error: any) {
                console.warn(`[Neural Channel Offline] ${modelId}: ${error.message}`);
                lastError = error;
                // Continue to next model
            }
        }

        throw lastError || new Error("Neural Hub Critical Failure.");

    } catch (error: any) {
        console.error("❌ FETS OMNI EXCEPTION:", error);

        if (error.message?.includes("API key")) {
            throw new Error("Neural Link Denied: API Key Verification Failed.");
        }

        throw new Error(`Neural Engine Malfunction: ${error.message || "Unknown Core Error"}`);
    }
}

/**
 * Determine which data domains are relevant for a query
 */
export function determineRequiredDataDomains(query: string): string {
    const domains: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('incident') || lowerQuery.includes('issue') || lowerQuery.includes('problem')) {
        domains.push('Incidents History');
    }
    if (lowerQuery.includes('candidate') || lowerQuery.includes('student') || lowerQuery.includes('examinee')) {
        domains.push('Candidate Registry', 'Exam Registrations');
    }
    if (lowerQuery.includes('exam') || lowerQuery.includes('session') || lowerQuery.includes('test')) {
        domains.push('Sessions Archive', 'Exams Conducted', 'Future Sessions', 'Exam Intelligence');
    }
    if (lowerQuery.includes('roster') || lowerQuery.includes('duty') || lowerQuery.includes('schedule') || lowerQuery.includes('staff')) {
        domains.push('Roster History', 'Staff Records');
    }
    if (lowerQuery.includes('vault') || lowerQuery.includes('document') || lowerQuery.includes('file')) {
        domains.push('Vault Documents');
    }
    if (lowerQuery.includes('branch') || lowerQuery.includes('location') || lowerQuery.includes('center')) {
        domains.push('Branch Status');
    }
    if (lowerQuery.includes('leave') || lowerQuery.includes('absence')) {
        domains.push('Leave Records');
    }
    if (lowerQuery.includes('notice') || lowerQuery.includes('announcement') || lowerQuery.includes('broadcast')) {
        domains.push('Notices Archive', 'Social Posts');
    }
    if (lowerQuery.includes('lost') || lowerQuery.includes('found') || lowerQuery.includes('item')) {
        domains.push('Lost & Found');
    }
    if (domains.length === 0) {
        domains.push('Complete System Data');
    }
    
    return domains.join(', ');
}
