import SwiftUI

struct CandidatesView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var date = Date()
    @State private var candidates: [Candidate] = []
    @State private var loading = true

    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(dateFormatter.string(from: date))
                        .font(.subheadline)
                        .foregroundStyle(FetsColor.inkMuted)
                    Spacer()
                    Button("‹ Prev") { shiftDay(-1) }
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(FetsColor.deepTeal)
                    Button("Next ›") { shiftDay(1) }
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(FetsColor.deepTeal)
                }

                if loading {
                    Spacer()
                    ProgressView().tint(FetsColor.deepTeal).frame(maxWidth: .infinity)
                    Spacer()
                } else if candidates.isEmpty {
                    Spacer()
                    EmptyState(icon: "graduationcap", title: "No candidates", message: "No exams scheduled at this centre on this day.")
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(candidates) { c in
                                HStack(spacing: 12) {
                                    Text(c.name.prefix(1).uppercased())
                                        .font(.headline.weight(.heavy))
                                        .foregroundStyle(FetsColor.deepTeal)
                                        .frame(width: 40, height: 40)
                                        .background(FetsColor.gold.opacity(0.25), in: Circle())
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(c.name).font(.headline).foregroundStyle(FetsColor.ink)
                                        Text(subtitle(c))
                                            .font(.subheadline)
                                            .foregroundStyle(FetsColor.inkMuted)
                                    }
                                    Spacer()
                                }
                                .padding(14)
                                .background(Color.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                        }
                        .padding(.bottom, 16)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .background(FetsColor.paper)
            .navigationTitle("Candidate Register")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .task(id: dateFormatter.string(from: date)) {
            loading = true
            candidates = await FetsService.shared.loadCandidates(for: date, branch: session.activeBranch)
            loading = false
        }
    }

    private func subtitle(_ c: Candidate) -> String {
        let parts = [c.module, c.status].compactMap { $0 }.filter { !$0.isEmpty }
        if !parts.isEmpty { return parts.joined(separator: " · ") }
        return (c.examDate ?? "").prefix(16).description
    }

    private func shiftDay(_ delta: Int) {
        date = Calendar.current.date(byAdding: .day, value: delta, to: date) ?? date
    }
}
