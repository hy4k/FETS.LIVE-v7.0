import SwiftUI

struct CasesView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var cases: [Incident] = []
    @State private var loading = true
    @State private var filter = "all"
    @State private var showNewCase = false

    private let filters = ["all", "open", "in_progress", "closed"]

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title: "Cases · Floor Log")

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(filters, id: \.self) { f in
                            Button {
                                filter = f
                            } label: {
                                Text(f.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .font(.subheadline.weight(.bold))
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .foregroundStyle(filter == f ? FetsColor.deepTealDark : FetsColor.inkMuted)
                                    .background(
                                        filter == f ? FetsColor.gold : Color.white,
                                        in: Capsule()
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if loading {
                    Spacer()
                    ProgressView().tint(FetsColor.deepTeal).frame(maxWidth: .infinity)
                    Spacer()
                } else {
                    let visible = cases.filter { filter == "all" || $0.status == filter }
                    if visible.isEmpty {
                        Spacer()
                        EmptyState(icon: "tray", title: "No \(filter.replacingOccurrences(of: "_", with: " ")) cases", message: "New cases opened from the app appear here instantly.")
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 10) {
                                ForEach(visible) { IncidentRow(incident: $0) }
                            }
                            .padding(.bottom, 16)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .background(FetsColor.paper)
            .navigationBarHidden(true)
            .overlay(alignment: .bottomTrailing) {
                Button {
                    showNewCase = true
                } label: {
                    Image(systemName: "plus")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(FetsColor.gold)
                        .frame(width: 56, height: 56)
                        .background(FetsColor.deepTeal, in: Circle())
                        .shadow(color: .black.opacity(0.25), radius: 8, y: 4)
                }
                .padding(.trailing, 20)
                .padding(.bottom, 20)
            }
            .sheet(isPresented: $showNewCase) {
                NewCaseView(onDone: { showNewCase = false })
            }
        }
        .task(id: session.activeBranch) {
            loading = true
            cases = await FetsService.shared.loadCases(branch: session.activeBranch)
            loading = false
        }
    }
}
