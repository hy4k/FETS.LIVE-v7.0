import SwiftUI

enum HomeSheet: String, Identifiable {
    case newCase, onDuty, candidates
    var id: String { rawValue }
}

struct HomeView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var snapshot = HomeSnapshot()
    @State private var loading = true
    @State private var sheet: HomeSheet?

    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    greetingHeader

                    if loading {
                        ProgressView().tint(FetsColor.deepTeal).frame(maxWidth: .infinity).padding(40)
                    } else {
                        LazyVGrid(columns: columns, spacing: 10) {
                            StatCard(label: "Candidates Today", value: "\(snapshot.candidatesToday)", icon: "graduationcap")
                            StatCard(label: "Open Cases", value: "\(snapshot.openCases)", icon: "bell.badge", accent: Color(red: 0xF8/255, green: 0x71/255, blue: 0x71/255))
                            StatCard(label: "Staff Present", value: "\(snapshot.staffPresent)", icon: "person.2", accent: Color(red: 0x34/255, green: 0xD3/255, blue: 0x99/255))
                            StatCard(label: "Sessions Today", value: "\(snapshot.sessionsToday)", icon: "briefcase", accent: Color(red: 0x60/255, green: 0xA5/255, blue: 0xFA/255))
                        }

                        if !snapshot.news.isEmpty {
                            SectionHeader(title: "Centre Wire")
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
                                    ForEach(snapshot.news) { item in
                                        HStack(spacing: 8) {
                                            Image(systemName: "newspaper")
                                            Text(item.text)
                                                .lineLimit(2)
                                                .frame(maxWidth: 260, alignment: .leading)
                                        }
                                        .font(.subheadline)
                                        .foregroundStyle(FetsColor.deepTealDark)
                                        .padding(12)
                                        .background(FetsColor.gold.opacity(0.16), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                                    }
                                }
                            }
                        }

                        SectionHeader(title: "Quick Actions")
                        LazyVGrid(columns: columns, spacing: 10) {
                            QuickAction(label: "Open Case", icon: "plus", color: FetsColor.gold) { sheet = .newCase }
                            QuickAction(label: "On Duty", icon: "person.2", color: Color(red: 0x34/255, green: 0xD3/255, blue: 0x99/255)) { sheet = .onDuty }
                            QuickAction(label: "Candidates", icon: "graduationcap", color: Color(red: 0x60/255, green: 0xA5/255, blue: 0xFA/255)) { sheet = .candidates }
                        }

                        SectionHeader(title: "Open Cases")
                        if snapshot.recentCases.isEmpty {
                            EmptyState(icon: "checkmark.seal", title: "No open cases", message: "The floor is clear. Nice work.")
                        } else {
                            ForEach(snapshot.recentCases) { IncidentRow(incident: $0) }
                        }
                    }
                }
                .padding(16)
            }
            .background(FetsColor.paper)
            .navigationBarHidden(true)
            .sheet(item: $sheet) { item in
                switch item {
                case .newCase:
                    NewCaseView(onDone: { sheet = nil })
                case .onDuty:
                    OnDutyView()
                case .candidates:
                    CandidatesView()
                }
            }
        }
        .task(id: session.activeBranch) {
            loading = true
            snapshot = await FetsService.shared.loadHomeSnapshot(branch: session.activeBranch)
            loading = false
        }
    }

    private var greetingHeader: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text(greeting)
                    .font(.system(.title, design: .rounded, weight: .heavy))
                    .foregroundStyle(FetsColor.deepTealDark)
                Text(branchLabel)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(FetsColor.deepTeal.opacity(0.6))
            }
            Spacer()
            FetsMonogram(size: 46)
        }
    }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let word = h >= 5 && h < 12 ? "Good morning" : (h >= 12 && h < 17 ? "Good afternoon" : "Good evening")
        let name = session.profile?.fullName.split(separator: " ").first.map(String.init) ?? ""
        return "\(word), \(name)"
    }

    private var branchLabel: String {
        switch session.activeBranch {
        case "calicut": return "Calicut HQ"
        case "cochin": return "Cochin Center"
        default: return "Global View"
        }
    }
}

private struct QuickAction: View {
    let label: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(color)
                    .frame(width: 36, height: 36)
                    .background(color.opacity(0.18), in: Circle())
                Text(label.uppercased())
                    .font(.system(size: 8, weight: .heavy, design: .rounded))
                    .tracking(1)
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(FetsColor.deepTeal, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
