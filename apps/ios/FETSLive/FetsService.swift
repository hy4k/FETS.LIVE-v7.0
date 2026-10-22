import Foundation
import Supabase

/// All backend access for the native app — same Supabase project the web platform uses.
final class FetsService {
    static let shared = FetsService()

    // Public anon key — identical to the web SPA. RLS protects the data.
    private let url = URL(string: "https://qqewusetilxxfvfkmsed.supabase.co")!
    private let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s"

    private(set) lazy var client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)

    private var istCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Kolkata") ?? .current
        return cal
    }

    private func todayIst() -> String {
        let fmt = DateFormatter()
        fmt.calendar = istCalendar
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: Date())
    }

    private func dayRange(_ date: Date) -> (String, String) {
        let fmt = DateFormatter()
        fmt.calendar = istCalendar
        fmt.dateFormat = "yyyy-MM-dd"
        let day = fmt.string(from: date)
        return ("\(day)T00:00:00+05:30", "\(day)T23:59:59.999+05:30")
    }

    // MARK: - Auth

    func restoreSession() async throws -> StaffProfile? {
        guard let session = client.auth.currentSession else { return nil }
        return try await loadProfile(userId: session.user.id.uuidString)
    }

    func signIn(email: String, password: String) async throws -> StaffProfile {
        try await client.auth.signIn(email: email, password: password)
        guard let user = client.auth.currentUser else {
            throw NSError(domain: "FETS", code: 1, userInfo: [NSLocalizedDescriptionKey: "Sign-in failed. Check your email and password."])
        }
        return try await loadProfile(userId: user.id.uuidString)
    }

    func signOut() async {
        try? await client.auth.signOut()
    }

    private func loadProfile(userId: String) async throws -> StaffProfile {
        let rows: [StaffProfile] = try await client.from("profiles")
            .select()
            .eq("id", value: userId)
            .execute()
            .value
        return rows.first ?? StaffProfile(id: userId, fullName: "", email: "", role: "", branchAssigned: nil)
    }

    // MARK: - Home

    func loadHomeSnapshot(branch: String) async -> HomeSnapshot {
        var snapshot = HomeSnapshot()
        let (start, end) = dayRange(Date())

        if let candidates: [Candidate] = try? await client.from("candidates")
            .select()
            .gte("exam_date", value: start)
            .lte("exam_date", value: end)
            .branch(branch)
            .execute().value {
            snapshot.candidatesToday = candidates.count
        }

        if let open: [Incident] = try? await client.from("incidents")
            .select()
            .eq("status", value: "open")
            .branch(branch)
            .order("created_at", ascending: false)
            .execute().value {
            snapshot.openCases = open.count
            snapshot.recentCases = Array(open.prefix(5))
        }

        if let attendance: [StaffAttendance] = try? await client.from("staff_attendance")
            .select()
            .eq("date", value: todayIst())
            .branch(branch)
            .execute().value {
            snapshot.staffPresent = attendance.filter { !($0.checkIn ?? "").isEmpty }.count
        }

        if let sessions: [CalendarSession] = try? await client.from("calendar_sessions")
            .select()
            .gte("date", value: start)
            .lte("date", value: end)
            .branch(branch)
            .execute().value {
            snapshot.sessionsToday = sessions.count
        }

        if let rows: [NewsRow] = try? await client.from("news_ticker")
            .select()
            .order("created_at", ascending: false)
            .limit(5)
            .execute().value {
            snapshot.news = rows.compactMap { row in
                guard let text = row.message ?? row.title ?? row.text else { return nil }
                let id = row.id ?? row.createdAt ?? UUID().uuidString
                return NewsItem(id: id, text: text)
            }
        }

        return snapshot
    }

    // MARK: - Cases

    func loadCases(branch: String) async -> [Incident] {
        (try? await client.from("incidents")
            .select()
            .branch(branch)
            .order("created_at", ascending: false)
            .limit(50)
            .execute().value) ?? []
    }

    func openCase(profile: StaffProfile, branch: String, title: String, description: String, category: String) async throws {
        let targetBranch = branch == "global" ? "calicut" : branch
        let incident = NewIncident(
            title: title,
            description: description,
            category: category,
            status: "open",
            severity: "minor",
            reporter: profile.fullName.isEmpty ? "Staff" : profile.fullName,
            branchLocation: targetBranch,
            userId: profile.id
        )
        try await client.from("incidents").insert(incident).execute()
    }

    // MARK: - Candidates / Calendar / On-duty

    func loadCandidates(for date: Date, branch: String) async -> [Candidate] {
        let (start, end) = dayRange(date)
        return (try? await client.from("candidates")
            .select()
            .gte("exam_date", value: start)
            .lte("exam_date", value: end)
            .branch(branch)
            .order("exam_date", ascending: true)
            .execute().value) ?? []
    }

    func loadSessions(yearMonth: String, branch: String) async -> [CalendarSession] {
        (try? await client.from("calendar_sessions")
            .select()
            .gte("date", value: "\(yearMonth)-01T00:00:00+05:30")
            .lte("date", value: "\(yearMonth)-31T23:59:59.999+05:30")
            .branch(branch)
            .order("date", ascending: true)
            .execute().value) ?? []
    }

    func loadOnDutyToday(branch: String) async -> [StaffAttendance] {
        (try? await client.from("staff_attendance")
            .select()
            .eq("date", value: todayIst())
            .branch(branch)
            .execute().value) ?? []
    }

    // MARK: - FETS Intelligence

    func askAgent(branch: String, page: String, message: String, history: [(role: String, text: String)]) async throws -> String {
        let body: [String: AnyJSON] = [
            "action": .string("chat"),
            "branch": .string(branch),
            "page": .string(page),
            "message": .string(message),
            "history": .array(history.map { .object(["role": .string($0.role), "text": .string($0.text)]) }),
        ]
        let response = try await client.functions.invoke(
            "fets-ai-agent",
            options: FunctionInvokeOptions(headers: ["Content-Type": "application/json"], body: body)
        )
        let json = try JSONSerialization.jsonObject(with: response.data) as? [String: Any]
        if let error = json?["error"] as? String { throw NSError(domain: "FETS", code: 2, userInfo: [NSLocalizedDescriptionKey: error]) }
        guard let text = json?["text"] as? String, !text.isEmpty else {
            throw NSError(domain: "FETS", code: 3, userInfo: [NSLocalizedDescriptionKey: "The assistant returned an empty reply."])
        }
        return text
    }
}

private extension PostgrestFilterBuilder {
    /// Applies the active-centre filter unless the user is in Global View.
    func branch(_ branch: String) -> PostgrestFilterBuilder {
        branch == "global" ? self : eq("branch_location", value: branch)
    }
}
