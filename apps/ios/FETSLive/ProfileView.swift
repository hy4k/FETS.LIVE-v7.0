import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var session: SessionManager

    private let branches: [(id: String, label: String)] = [
        ("global", "Global View"),
        ("calicut", "Calicut HQ"),
        ("cochin", "Cochin Center"),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let profile = session.profile {
                        HStack(spacing: 12) {
                            Text(initials(profile.fullName))
                                .font(.title.weight(.heavy))
                                .foregroundStyle(FetsColor.gold)
                                .frame(width: 56, height: 56)
                                .background(FetsColor.deepTeal, in: Circle())
                            VStack(alignment: .leading, spacing: 2) {
                                Text(profile.fullName.isEmpty ? "Staff Member" : profile.fullName)
                                    .font(.title2.weight(.heavy))
                                    .foregroundStyle(FetsColor.ink)
                                Text(profile.email)
                                    .font(.subheadline)
                                    .foregroundStyle(FetsColor.inkMuted)
                            }
                        }

                        VStack(spacing: 0) {
                            ProfileRow(label: "Role", value: profile.role.replacingOccurrences(of: "_", with: " "))
                            Divider().padding(.leading, 46)
                            ProfileRow(label: "Assigned centre", value: profile.branchAssigned ?? "—")
                            Divider().padding(.leading, 46)
                            ProfileRow(label: "Status", value: "Active")
                        }
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                        SectionHeader(title: "Working Centre")
                        VStack(spacing: 0) {
                            ForEach(branches, id: \.id) { b in
                                let selected = session.activeBranch == b.id
                                Button {
                                    session.activeBranch = b.id
                                } label: {
                                    HStack {
                                        Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                            .foregroundStyle(selected ? FetsColor.deepTeal : FetsColor.inkMuted)
                                        Text(b.label)
                                            .font(.body.weight(selected ? .bold : .medium))
                                            .foregroundStyle(FetsColor.ink)
                                        Spacer()
                                    }
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 12)
                                    .background(
                                        selected ? FetsColor.gold.opacity(0.16) : .clear,
                                        in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }

                    Button(role: .destructive) {
                        Task { await session.signOut() }
                    } label: {
                        Text("Sign Out")
                            .fontWeight(.extraBold)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .foregroundStyle(Color(red: 0xB9/255, green: 0x1C/255, blue: 0x1C/255))
                            .background(Color(red: 0xFE/255, green: 0xE2/255, blue: 0xE2/255), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                .padding(16)
            }
            .background(FetsColor.paper)
            .navigationBarHidden(true)
        }
    }

    private func initials(_ name: String) -> String {
        name.split(separator: " ").compactMap { $0.first.map(String.init) }.prefix(2).joined().uppercased()
    }
}

private struct ProfileRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.body)
                .foregroundStyle(FetsColor.inkMuted)
            Spacer()
            Text(value.capitalized)
                .font(.body.weight(.bold))
                .foregroundStyle(FetsColor.ink)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }
}
