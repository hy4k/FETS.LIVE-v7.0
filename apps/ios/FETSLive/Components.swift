import SwiftUI

struct FetsBottomBar: View {
    @Binding var tab: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { item in
                Button {
                    withAnimation(.snappy) { tab = item }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: item.icon)
                            .font(.system(size: 19))
                        Text(item.label.uppercased())
                            .font(.system(size: 8, weight: .bold, design: .rounded))
                            .tracking(1)
                    }
                    .foregroundStyle(tab == item ? FetsColor.gold : .white.opacity(0.38))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(tab == item ? FetsColor.gold.opacity(0.12) : .clear)
                            .padding(.horizontal, 6)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(FetsColor.deepTealDark.opacity(0.96))
                .overlay(
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .stroke(FetsColor.gold.opacity(0.12), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.25), radius: 16, y: 6)
        )
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }
}

struct SectionHeader: View {
    let title: String
    var body: some View {
        Text(title.uppercased())
            .font(.system(size: 11, weight: .heavy, design: .rounded))
            .tracking(1.6)
            .foregroundStyle(FetsColor.deepTeal.opacity(0.7))
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct StatCard: View {
    let label: String
    let value: String
    let icon: String
    var accent: Color = FetsColor.gold

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 15))
                .foregroundStyle(accent)
                .frame(width: 34, height: 34)
                .background(accent.opacity(0.16), in: Circle())
            Text(value)
                .font(.system(size: 26, weight: .black, design: .rounded))
                .foregroundStyle(.white)
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .tracking(1.2)
                .foregroundStyle(.white.opacity(0.55))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(FetsColor.deepTeal, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

struct StatusChip: View {
    let status: String

    var body: some View {
        Text(status.replacingOccurrences(of: "_", with: " ").uppercased())
            .font(.system(size: 8, weight: .heavy, design: .rounded))
            .tracking(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(FetsTheme.statusColor(status))
            .background(FetsTheme.statusColor(status).opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct IncidentRow: View {
    let incident: Incident

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(categoryColor)
                .frame(width: 10, height: 10)
            VStack(alignment: .leading, spacing: 2) {
                Text(incident.title)
                    .font(.headline)
                    .foregroundStyle(FetsColor.ink)
                    .lineLimit(1)
                Text("\(categoryLabel) · \(incident.reporter ?? "Staff")")
                    .font(.subheadline)
                    .foregroundStyle(FetsColor.inkMuted)
            }
            Spacer()
            StatusChip(status: incident.status)
        }
        .padding(14)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }

    private var category: CaseCategory? {
        caseCategories.first { $0.id == incident.category }
    }

    private var categoryLabel: String {
        category?.label ?? incident.category
    }

    private var categoryColor: Color {
        Color(uiColor: UIColor(rgb: category?.color ?? 0x94A3B8))
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 34))
                .foregroundStyle(FetsColor.deepTeal.opacity(0.3))
            Text(title).font(.headline).foregroundStyle(FetsColor.ink)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(FetsColor.inkMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(36)
    }
}

extension UIColor {
    convenience init(rgb: UInt) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255.0,
            green: CGFloat((rgb >> 8) & 0xFF) / 255.0,
            blue: CGFloat(rgb & 0xFF) / 255.0,
            alpha: 1.0
        )
    }
}
