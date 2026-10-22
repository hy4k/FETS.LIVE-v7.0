import SwiftUI

// FETS LIVE "golden theme" — matches the web platform tokens and the Android app.
enum FetsColor {
    static let deepTeal = Color(red: 0x1A / 255.0, green: 0x3A / 255.0, blue: 0x3D / 255.0)
    static let deepTealDark = Color(red: 0x10 / 255.0, green: 0x27 / 255.0, blue: 0x2A / 255.0)
    static let tealSurface = Color(red: 0x14 / 255.0, green: 0x33 / 255.0, blue: 0x36 / 255.0)
    static let gold = Color(red: 0xFA / 255.0, green: 0xCC / 255.0, blue: 0x15 / 255.0)
    static let paper = Color(red: 0xF5 / 255.0, green: 0xF2 / 255.0, blue: 0xEA / 255.0)
    static let ink = Color(red: 0x1A / 255.0, green: 0x2E / 255.0, blue: 0x30 / 255.0)
    static let inkMuted = Color(red: 0x5C / 255.0, green: 0x6B / 255.0, blue: 0x6D / 255.0)
    static let open = Color(red: 0xEF / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)
    static let progress = Color(red: 0xF5 / 255.0, green: 0x9E / 255.0, blue: 0x0B / 255.0)
    static let closed = Color(red: 0x10 / 255.0, green: 0xB9 / 255.0, blue: 0x81 / 255.0)
}

enum FetsTheme {
    static func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "open": return FetsColor.open
        case "in_progress", "assigned", "escalated": return FetsColor.progress
        default: return FetsColor.closed
        }
    }
}
