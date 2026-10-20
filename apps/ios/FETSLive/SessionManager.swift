import Foundation
import SwiftUI

enum SessionState {
    case loading
    case signedOut
    case signedIn(StaffProfile)
}

@MainActor
final class SessionManager: ObservableObject {
    @Published private(set) var state: SessionState = .loading
    @Published var activeBranch: String = "global"

    private let service = FetsService.shared

    func restore() async {
        if let profile = try? await service.restoreSession() {
            state = .signedIn(profile)
        } else {
            state = .signedOut
        }
    }

    func signIn(email: String, password: String) async -> String? {
        do {
            let profile = try await service.signIn(email: email, password: password)
            state = .signedIn(profile)
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    func signOut() async {
        await service.signOut()
        state = .signedOut
    }

    var profile: StaffProfile? {
        if case .signedIn(let p) = state { return p }
        return nil
    }
}
