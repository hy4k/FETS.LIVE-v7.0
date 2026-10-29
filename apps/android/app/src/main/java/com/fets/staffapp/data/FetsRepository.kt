package com.fets.staffapp.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class FetsRepository(val client: SupabaseClient) {

    private val ist: ZoneId = ZoneId.of("Asia/Kolkata")

    private fun todayIst(): String =
        LocalDate.now(ist).format(DateTimeFormatter.ISO_LOCAL_DATE)

    private fun dayRangeIst(date: LocalDate): Pair<String, String> {
        // The web platform stores exam_date as ISO timestamps in +05:30.
        val day = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        return "$day" to "$day"
    }

    suspend fun loadProfile(userId: String): StaffProfile = runCatching {
        client.postgrest.from("profiles")
            .select { filter { eq("id", userId) } }
            .decodeSingle<StaffProfile>()
    }.getOrElse { StaffProfile(id = userId) }

    suspend fun loadHomeSnapshot(branch: String): HomeSnapshot {
        val today = todayIst()
        val (dayStart, dayEnd) = dayRangeIst(LocalDate.now(ist))

        val candidates = runCatching {
            client.postgrest.from("candidates").select {
                filter {
                    gte("exam_date", "${dayStart}T00:00:00+05:30")
                    lte("exam_date", "${dayEnd}T23:59:59.999+05:30")
                    if (branch != "global") eq("branch_location", branch)
                }
            }.decodeList<Candidate>()
        }.getOrDefault(emptyList())

        val openCases = runCatching {
            client.postgrest.from("incidents").select {
                filter {
                    eq("status", "open")
                    if (branch != "global") eq("branch_location", branch)
                }
                order("created_at", Order.DESCENDING)
            }.decodeList<Incident>()
        }.getOrDefault(emptyList())

        val attendance = runCatching {
            client.postgrest.from("staff_attendance").select {
                filter {
                    eq("date", today)
                    if (branch != "global") eq("branch_location", branch)
                }
            }.decodeList<StaffAttendance>()
        }.getOrDefault(emptyList())

        val sessions = runCatching {
            client.postgrest.from("calendar_sessions").select {
                filter {
                    gte("date", "${dayStart}T00:00:00+05:30")
                    lte("date", "${dayEnd}T23:59:59.999+05:30")
                    if (branch != "global") eq("branch_location", branch)
                }
            }.decodeList<CalendarSession>()
        }.getOrDefault(emptyList())

        val news = runCatching {
            client.postgrest.from("news_ticker").select {
                order("created_at", Order.DESCENDING)
                limit(5)
            }.decodeList<JsonObject>().mapNotNull { row ->
                val text = row["message"].contentOrNull
                    ?: row["title"].contentOrNull
                    ?: row["text"].contentOrNull
                val id = row["id"].contentOrNull ?: row["created_at"].contentOrNull
                if (text != null && id != null) NewsItem(id, text) else null
            }
        }.getOrDefault(emptyList())

        return HomeSnapshot(
            candidatesToday = candidates.size,
            openCases = openCases.size,
            staffPresent = attendance.count { !it.checkIn.isNullOrBlank() },
            sessionsToday = sessions.size,
            recentCases = openCases.take(5),
            news = news,
        )
    }

    suspend fun loadCases(branch: String): List<Incident> = runCatching {
        client.postgrest.from("incidents").select {
            filter { if (branch != "global") eq("branch_location", branch) }
            order("created_at", Order.DESCENDING)
            limit(50)
        }.decodeList<Incident>()
    }.getOrDefault(emptyList())

    suspend fun openCase(
        profile: StaffProfile,
        branch: String,
        title: String,
        description: String,
        category: String,
        metadata: Map<String, String>,
    ): Result<Unit> = runCatching {
        val targetBranch = if (branch == "global") "calicut" else branch
        val metaJson = if (metadata.isEmpty()) null else JsonObject(
            metadata.mapValues { (_, v) -> JsonPrimitive(v) }
        )
        client.postgrest.from("incidents").insert(
            Incident(
                title = title,
                description = description,
                category = category,
                status = "open",
                severity = "minor",
                reporter = profile.fullName.ifBlank { "Staff" },
                branchLocation = targetBranch,
                userId = profile.id,
                metadata = metaJson,
            )
        )
    }

    suspend fun loadCandidatesFor(date: LocalDate, branch: String): List<Candidate> = runCatching {
        val day = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        client.postgrest.from("candidates").select {
            filter {
                gte("exam_date", "${day}T00:00:00+05:30")
                lte("exam_date", "${day}T23:59:59.999+05:30")
                if (branch != "global") eq("branch_location", branch)
            }
            order("exam_date", Order.ASCENDING)
        }.decodeList<Candidate>()
    }.getOrDefault(emptyList())

    suspend fun loadSessionsForMonth(yearMonth: String, branch: String): List<CalendarSession> = runCatching {
        client.postgrest.from("calendar_sessions").select {
            filter {
                gte("date", "${yearMonth}-01T00:00:00+05:30")
                lte("date", "${yearMonth}-31T23:59:59.999+05:30")
                if (branch != "global") eq("branch_location", branch)
            }
            order("date", Order.ASCENDING)
        }.decodeList<CalendarSession>()
    }.getOrDefault(emptyList())

    suspend fun loadOnDutyToday(branch: String): List<StaffAttendance> = runCatching {
        client.postgrest.from("staff_attendance").select {
            filter {
                eq("date", todayIst())
                if (branch != "global") eq("branch_location", branch)
            }
        }.decodeList<StaffAttendance>()
    }.getOrDefault(emptyList())

    suspend fun loadBranchStatus(): List<BranchStatus> = runCatching {
        client.postgrest.from("branch_status")
            .select { order("branch_name", Order.ASCENDING) }
            .decodeList<BranchStatus>()
    }.getOrDefault(emptyList())

    /** FETS Intelligence — same `fets-ai-agent` edge function the web platform calls. */
    suspend fun askAgent(
        branch: String,
        page: String,
        message: String,
        history: List<Pair<String, String>>,
    ): Result<String> = runCatching {
        val body = buildJsonObject {
            put("action", "chat")
            put("branch", branch)
            put("page", page)
            put("message", message)
            put(
                "history",
                JsonArray(
                    history.map { (role, text) ->
                        buildJsonObject {
                            put("role", role)
                            put("text", text)
                        }
                    }
                )
            )
        }
        val response = client.functions.invoke("fets-ai-agent") {
            contentType(ContentType.Application.Json)
            setBody(body.toString())
        }
        val obj = Json.parseToJsonElement(response.bodyAsText()) as? JsonObject
        val error = obj?.get("error").contentOrNull
        if (error != null) throw IllegalStateException(error)
        obj?.get("text").contentOrNull
            ?: throw IllegalStateException("The assistant returned an empty reply.")
    }
}

private val JsonElement?.contentOrNull: String?
    get() = (this as? JsonPrimitive)?.contentOrNull
