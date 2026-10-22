import SwiftUI

private struct ChatMessage: Identifiable {
    let id = UUID()
    let role: String
    let text: String
}

struct AiView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var busy = false
    @State private var notice: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 10) {
                            if messages.isEmpty {
                                Text("Ask about today's roster, candidate counts, shift handovers, or any centre operations. I answer from the live FETS knowledge base.")
                                    .font(.subheadline)
                                    .foregroundStyle(FetsColor.deepTealDark)
                                    .padding(16)
                                    .background(FetsColor.gold.opacity(0.16), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                    .padding(.top, 12)
                            }
                            ForEach(messages) { m in
                                MessageBubble(message: m)
                                    .id(m.id)
                            }
                            if let notice {
                                Text(notice)
                                    .font(.footnote)
                                    .foregroundStyle(.red)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    .onChange(of: messages.count) { _ in
                        if let last = messages.last { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }

                HStack(spacing: 8) {
                    TextField("Ask FETS Intelligence…", text: $input, axis: .vertical)
                        .lineLimit(1...4)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background(Color.white, in: Capsule())
                        .overlay(Capsule().stroke(FetsColor.deepTeal.opacity(0.3), lineWidth: 1))

                    Button {
                        send()
                    } label: {
                        Image(systemName: "paperplane.fill")
                            .foregroundStyle(FetsColor.gold)
                            .frame(width: 44, height: 44)
                            .background(FetsColor.deepTeal, in: Circle())
                    }
                    .disabled(busy || input.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .background(FetsColor.paper)
            .navigationTitle("FETS Intelligence")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func send() {
        let text = input.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, !busy else { return }
        input = ""
        busy = true
        notice = nil
        messages.append(ChatMessage(role: "user", text: text))
        let history = messages.suffix(8).map { (role: $0.role, text: $0.text) }
        Task {
            do {
                let reply = try await FetsService.shared.askAgent(
                    branch: session.activeBranch,
                    page: "ai",
                    message: text,
                    history: history
                )
                await MainActor.run {
                    messages.append(ChatMessage(role: "assistant", text: reply))
                    busy = false
                }
            } catch {
                await MainActor.run {
                    notice = error.localizedDescription
                    busy = false
                }
            }
        }
    }
}

private struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 40) }
            Text(message.text)
                .font(.body)
                .foregroundStyle(message.role == "user" ? FetsColor.gold : FetsColor.ink)
                .padding(12)
                .background(
                    message.role == "user" ? FetsColor.deepTeal : Color.white,
                    in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                )
                .shadow(color: .black.opacity(0.04), radius: 3, y: 1)
            if message.role != "user" { Spacer(minLength: 40) }
        }
    }
}
