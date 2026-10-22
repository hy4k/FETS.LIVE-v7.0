import SwiftUI

struct CalendarView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var displayedMonth = Date()
    @State private var selectedDay = Date()
    @State private var sessions: [CalendarSession] = []
    @State private var loading = true

    private let dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private let monthFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMMM yyyy"
        return f
    }()
    private let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEE, d MMM"
        return f
    }()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        SectionHeader(title: monthFormatter.string(from: displayedMonth))
                        Spacer()
                        Button("‹") { shiftMonth(-1) }.font(.title2).foregroundStyle(FetsColor.deepTeal)
                        Button("›") { shiftMonth(1) }.font(.title2).foregroundStyle(FetsColor.deepTeal)
                    }

                    monthGrid

                    SectionHeader(title: dayFormatter.string(from: selectedDay))
                    if loading {
                        ProgressView().tint(FetsColor.deepTeal).frame(maxWidth: .infinity).padding(30)
                    } else {
                        let key = dayKey(selectedDay)
                        let todays = sessions.filter { $0.date.hasPrefix(key) }
                        if todays.isEmpty {
                            EmptyState(icon: "calendar.badge.exclamationmark", title: "No sessions", message: "Nothing scheduled at this centre on this day.")
                        } else {
                            ForEach(todays) { s in
                                HStack(spacing: 12) {
                                    Image(systemName: "calendar")
                                        .foregroundStyle(FetsColor.deepTeal)
                                        .frame(width: 38, height: 38)
                                        .background(FetsColor.gold.opacity(0.2), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(s.title).font(.headline).foregroundStyle(FetsColor.ink)
                                        Text(timeLabel(s))
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
            .navigationBarHidden(true)
        }
        .task(id: "\(monthKey(displayedMonth))-\(session.activeBranch)") {
            loading = true
            sessions = await FetsService.shared.loadSessions(yearMonth: monthKey(displayedMonth), branch: session.activeBranch)
            loading = false
        }
    }

    private var monthGrid: some View {
        let grid = monthCells()
        return VStack(spacing: 4) {
            HStack {
                ForEach(dayLabels, id: \.self) { d in
                    Text(d.uppercased())
                        .font(.system(size: 9, weight: .heavy, design: .rounded))
                        .foregroundStyle(FetsColor.deepTeal.opacity(0.5))
                        .frame(maxWidth: .infinity)
                }
            }
            ForEach(0..<grid.count / 7, id: \.self) { row in
                HStack(spacing: 4) {
                    ForEach(0..<7, id: \.self) { col in
                        let cell = grid[row * 7 + col]
                        if let date = cell {
                            dayCell(date)
                        } else {
                            Color.clear.frame(maxWidth: .infinity).aspectRatio(1, contentMode: .fit)
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func dayCell(_ date: Date) -> some View {
        let day = Calendar.current.component(.day, from: date)
        let isSelected = dayKey(date) == dayKey(selectedDay)
        let isToday = dayKey(date) == dayKey(Date())
        let hasSessions = sessions.contains { $0.date.hasPrefix(dayKey(date)) }

        return Button {
            selectedDay = date
        } label: {
            VStack(spacing: 3) {
                Text("\(day)")
                    .font(.system(.body, design: .rounded, weight: isToday ? .heavy : .medium))
                    .foregroundStyle(isSelected ? FetsColor.gold : (isToday ? FetsColor.deepTeal : FetsColor.ink.opacity(0.8)))
                Circle()
                    .fill(hasSessions ? FetsColor.gold : .clear)
                    .frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(1, contentMode: .fit)
            .background(
                Circle().fill(isSelected ? FetsColor.deepTeal : .clear)
            )
        }
        .buttonStyle(.plain)
    }

    private func monthCells() -> [Date?] {
        var cal = Calendar(identifier: .gregorian)
        cal.firstWeekday = 2 // Monday
        let comps = cal.dateComponents([.year, .month], from: displayedMonth)
        let first = cal.date(from: comps)!
        let offset = (cal.component(.weekday, from: first) - 2 + 7) % 7
        let days = cal.range(of: .day, in: .month, for: first)!.count
        var cells: [Date?] = Array(repeating: nil, count: offset)
        for d in 1...days {
            cells.append(cal.date(byAdding: .day, value: d - 1, to: first))
        }
        while cells.count % 7 != 0 { cells.append(nil) }
        return cells
    }

    private func dayKey(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    private func monthKey(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM"
        return f.string(from: date)
    }

    private func shiftMonth(_ delta: Int) {
        displayedMonth = Calendar.current.date(byAdding: .month, value: delta, to: displayedMonth) ?? displayedMonth
    }

    private func timeLabel(_ s: CalendarSession) -> String {
        let t = [s.startTime?.prefix(5), s.endTime?.prefix(5)].compactMap { $0.map(String.init) }
        return t.isEmpty ? (s.branchLocation ?? "") : t.joined(separator: " – ")
    }
}
