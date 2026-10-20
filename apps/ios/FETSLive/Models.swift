import Foundation

struct StaffProfile: Decodable {
    let id: String
    let fullName: String
    let email: String
    let role: String
    let branchAssigned: String?

    enum CodingKeys: String, CodingKey {
        case id, email, role
        case fullName = "full_name"
        case branchAssigned = "branch_assigned"
    }
}

struct Incident: Decodable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let category: String
    let status: String
    let severity: String?
    let reporter: String?
    let branchLocation: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, category, status, severity, reporter
        case branchLocation = "branch_location"
        case createdAt = "created_at"
    }
}

struct NewIncident: Encodable {
    let title: String
    let description: String
    let category: String
    let status: String
    let severity: String
    let reporter: String
    let branchLocation: String
    let userId: String

    enum CodingKeys: String, CodingKey {
        case title, description, category, status, severity, reporter
        case branchLocation = "branch_location"
        case userId = "user_id"
    }
}

struct Candidate: Decodable, Identifiable {
    let id: String
    let name: String
    let examDate: String?
    let module: String?
    let branchLocation: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id, name, module, status
        case examDate = "exam_date"
        case branchLocation = "branch_location"
    }
}

struct CalendarSession: Decodable, Identifiable {
    let id: String
    let date: String
    let title: String
    let startTime: String?
    let endTime: String?
    let branchLocation: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id, date, title, status
        case startTime = "start_time"
        case endTime = "end_time"
        case branchLocation = "branch_location"
    }
}

struct StaffAttendance: Decodable {
    let staffId: String?
    let checkIn: String?
    let branchLocation: String?
    let date: String?

    enum CodingKeys: String, CodingKey {
        case date
        case staffId = "staff_id"
        case checkIn = "check_in"
        case branchLocation = "branch_location"
    }
}

struct NewsRow: Decodable {
    let id: String?
    let message: String?
    let title: String?
    let text: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, message, title, text
        case createdAt = "created_at"
    }
}

struct NewsItem: Identifiable {
    let id: String
    let text: String
}

struct HomeSnapshot {
    var candidatesToday = 0
    var openCases = 0
    var staffPresent = 0
    var sessionsToday = 0
    var recentCases: [Incident] = []
    var news: [NewsItem] = []
}

struct CaseCategory: Identifiable {
    let id: String
    let label: String
    let color: UInt
}

let caseCategories: [CaseCategory] = [
    CaseCategory(id: "roster", label: "Roster", color: 0x3B82F6),
    CaseCategory(id: "calendar", label: "Calendar", color: 0x8B5CF6),
    CaseCategory(id: "facility", label: "Facility", color: 0xF59E0B),
    CaseCategory(id: "systems", label: "Systems", color: 0x06B6D4),
    CaseCategory(id: "network", label: "Network", color: 0xEF4444),
    CaseCategory(id: "exam", label: "Exam", color: 0x10B981),
    CaseCategory(id: "assets", label: "Assets", color: 0xF97316),
    CaseCategory(id: "vendor", label: "Vendor", color: 0x6366F1),
    CaseCategory(id: "staff", label: "Staff", color: 0xEC4899),
]
