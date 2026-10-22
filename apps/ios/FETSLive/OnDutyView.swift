import SwiftUI

struct OnDutyView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var staff: [StaffAttendance] = []
    @State private var loading = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if loading {
                        ProgressView().tint(FetsColor.deepTeal).frame(maxWidth: .infinity).padding(40)
                    } else {
                        let present = staff.filter { !($0.checkIn ?? "").isEmpty }
                        if present.isEmpty {
                            EmptyState(icon: "person.2.slash", title: "Nobody checked in yet", message: "Check-ins for today will appear here.")
                        } else {
                            ForEach(Array(present.enumerated()), id: \.offset) { _, a in
                                HStack(spacing: 12) {
                                    Text((a.staffId ?? "?").prefix(2).uppercased())
                                        .font(.headline.weight(.heavy))
                                        .foregroundStyle(FetsColor.gold)
                                        .frame(width: 40, height: 40)
                                        .background(FetsColor.deepTeal, in: Circle())
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Staff · \(a.branchLocation ?? "—")")
                                            .font(.headline)
                                            .foregroundStyle(FetsColor.ink)
                                        Text(checkInLabel(a))
                                            .font(.subheadline)
                                            .foregroundStyle(FetsColor.inkMuted)
                                    }
                                    Spacer()
                                }
                                .padding(14)
                                .background(Color.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(FetsColor.paper)
            .navigationTitle("On Duty Today")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismissSelf() }
                }
            }
        }
        .task {
            loading = true
            staff = await FetsService.shared.loadOnDutyToday(branch: session.activeBranch)
            loading = false
        }
    }

    @Environment(\.dismiss) private var dismissSelf

    private func checkInLabel(_ a: StaffAttendance) -> String {
        guard let checkIn = a.checkIn, !checkIn.isEmpty else { return "" }
        return "Checked in \(checkIn.prefix(5))"
    }
}
