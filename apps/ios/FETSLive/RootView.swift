import SwiftUI

enum AppTab: String, CaseIterable {
    case home, calendar, cases, ai, profile

    var label: String {
        switch self {
        case .home: return "Home"
        case .calendar: return "Calendar"
        case .cases: return "Cases"
        case .ai: return "AI"
        case .profile: return "Profile"
        }
    }

    var icon: String {
        switch self {
        case .home: return "house"
        case .calendar: return "calendar"
        case .cases: return "wrench.and.screwdriver"
        case .ai: return "brain.head.profile"
        case .profile: return "person"
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var session: SessionManager

    var body: some View {
        Group {
            switch session.state {
            case .loading:
                FetsLoadingView()
            case .signedOut:
                LoginView()
            case .signedIn:
                MainTabView()
            }
        }
        .task { await session.restore() }
    }
}

struct MainTabView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var tab: AppTab = .home

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch tab {
                case .home: HomeView()
                case .calendar: CalendarView()
                case .cases: CasesView()
                case .ai: AiView()
                case .profile: ProfileView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(FetsColor.paper.ignoresSafeArea())
            .padding(.bottom, 76)

            FetsBottomBar(tab: $tab)
        }
    }
}

struct FetsLoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            FetsMonogram(size: 88)
            ProgressView().tint(FetsColor.deepTeal)
            Text("Getting your workspace ready…")
                .font(.subheadline)
                .foregroundStyle(FetsColor.inkMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(FetsColor.paper)
    }
}

struct FetsMonogram: View {
    let size: CGFloat

    init(size: CGFloat = 88) {
        self.size = size
    }

    var body: some View {
        Text("F")
            .font(.system(size: size * 0.52, weight: .black, design: .rounded))
            .foregroundStyle(FetsColor.gold)
            .frame(width: size, height: size)
            .background(
                LinearGradient(colors: [FetsColor.deepTeal, FetsColor.deepTealDark], startPoint: .topLeading, endPoint: .bottomTrailing),
                in: RoundedRectangle(cornerRadius: size / 4, style: .continuous)
            )
    }
}
