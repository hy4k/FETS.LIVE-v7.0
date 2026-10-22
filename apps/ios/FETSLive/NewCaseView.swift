import SwiftUI

struct NewCaseView: View {
    @EnvironmentObject private var session: SessionManager
    let onDone: () -> Void

    @State private var category = caseCategories[0].id
    @State private var title = ""
    @State private var description = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SectionHeader(title: "Category")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(caseCategories) { cat in
                                let selected = category == cat.id
                                Button {
                                    category = cat.id
                                } label: {
                                    HStack(spacing: 8) {
                                        Circle()
                                            .fill(Color(uiColor: UIColor(rgb: cat.color)))
                                            .frame(width: 8, height: 8)
                                        Text(cat.label)
                                            .font(.subheadline.weight(.bold))
                                            .foregroundStyle(selected ? FetsColor.gold : FetsColor.ink)
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 10)
                                    .background(
                                        selected ? FetsColor.deepTeal : Color.white,
                                        in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    SectionHeader(title: "Details")
                    VStack(spacing: 12) {
                        TextField("Title", text: $title, prompt: Text("Short summary of the issue"))
                        TextField("Description", text: $description, prompt: Text("What happened? Who is affected?"), axis: .vertical)
                            .lineLimit(4...8)
                    }
                    .textFieldStyle(FetsTextFieldStyle())

                    if let error {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }

                    Button {
                        submit()
                    } label: {
                        Group {
                            if busy {
                                ProgressView().tint(FetsColor.gold)
                            } else {
                                Text("Open Case").fontWeight(.extraBold).tracking(1)
                            }
                        }
                        .frame(maxWidth: .infinity).frame(height: 52)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(FetsColor.deepTeal)
                    .foregroundStyle(FetsColor.gold)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .disabled(busy || title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(16)
            }
            .background(FetsColor.paper)
            .navigationTitle("Open a Case")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { onDone() }
                }
            }
        }
    }

    private func submit() {
        guard let profile = session.profile else { return }
        busy = true
        error = nil
        Task {
            do {
                try await FetsService.shared.openCase(
                    profile: profile,
                    branch: session.activeBranch,
                    title: title.trimmingCharacters(in: .whitespaces),
                    description: description.trimmingCharacters(in: .whitespaces),
                    category: category
                )
                await MainActor.run { onDone() }
            } catch {
                await MainActor.run {
                    busy = false
                    self.error = error.localizedDescription
                }
            }
        }
    }
}
