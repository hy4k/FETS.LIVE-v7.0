package com.fets.live.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class StaffProfile(
    val id: String = "",
    @SerialName("full_name") val fullName: String = "",
    val email: String = "",
    val role: String = "",
    @SerialName("branch_assigned") val branchAssigned: String? = null,
)

@Serializable
data class Incident(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val category: String = "",
    val status: String = "open",
    val severity: String = "minor",
    val reporter: String = "",
    @SerialName("branch_location") val branchLocation: String? = null,
    @SerialName("user_id") val userId: String? = null,
    val metadata: JsonObject? = null,
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class Candidate(
    val id: String = "",
    val name: String = "",
    @SerialName("exam_date") val examDate: String? = null,
    val module: String? = null,
    @SerialName("branch_location") val branchLocation: String? = null,
    val status: String? = null,
)

@Serializable
data class CalendarSession(
    val id: String = "",
    val date: String = "",
    val title: String = "",
    @SerialName("start_time") val startTime: String? = null,
    @SerialName("end_time") val endTime: String? = null,
    @SerialName("branch_location") val branchLocation: String? = null,
    val status: String? = null,
    val notes: String? = null,
)

@Serializable
data class StaffAttendance(
    @SerialName("staff_id") val staffId: String? = null,
    @SerialName("check_in") val checkIn: String? = null,
    @SerialName("branch_location") val branchLocation: String? = null,
    val date: String? = null,
)

@Serializable
data class BranchStatus(
    val id: String = "",
    @SerialName("branch_name") val branchName: String = "",
    val status: String? = null,
)

/** Mirrors the web platform's CASE_CATEGORIES config (caseCategories.config.ts). */
data class CaseCategory(
    val id: String,
    val label: String,
    val color: Long,
)

val CASE_CATEGORIES = listOf(
    CaseCategory("roster", "Roster", 0xFF3B82F6),
    CaseCategory("calendar", "Calendar", 0xFF8B5CF6),
    CaseCategory("facility", "Facility", 0xFFF59E0B),
    CaseCategory("systems", "Systems", 0xFF06B6D4),
    CaseCategory("network", "Network", 0xFFEF4444),
    CaseCategory("exam", "Exam", 0xFF10B981),
    CaseCategory("assets", "Assets", 0xFFF97316),
    CaseCategory("vendor", "Vendor", 0xFF6366F1),
    CaseCategory("staff", "Staff", 0xFFEC4899),
)

data class NewsItem(val id: String, val text: String)

data class HomeSnapshot(
    val candidatesToday: Int = 0,
    val openCases: Int = 0,
    val staffPresent: Int = 0,
    val sessionsToday: Int = 0,
    val recentCases: List<Incident> = emptyList(),
    val news: List<NewsItem> = emptyList(),
)

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Error(val message: String) : UiState<Nothing>
    data class Ready<T>(val data: T) : UiState<T>
}
