import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Spacer(minLength: 60)
                FetsMonogram(size: 92)
                Text("FETS · LIVE")
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .tracking(2)
                    .foregroundStyle(FetsColor.deepTealDark)
                Text("Staff Command Centre")
                    .font(.subheadline)
                    .foregroundStyle(FetsColor.inkMuted)

                Spacer(minLength: 24)

                VStack(spacing: 14) {
                    TextField("Work email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                    SecureField("Password", text: $password)
                }
                .textFieldStyle(FetsTextFieldStyle())

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    attemptSignIn()
                } label: {
                    Group {
                        if busy {
                            ProgressView().tint(FetsColor.gold)
                        } else {
                            Text("Enter Workspace")
                                .fontWeight(.extraBold)
                                .tracking(1)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                }
                .buttonStyle(.borderedProminent)
                .tint(FetsColor.deepTeal)
                .foregroundStyle(FetsColor.gold)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .disabled(busy || email.isEmpty || password.isEmpty)

                Spacer(minLength: 40)
            }
            .padding(.horizontal, 28)
        }
        .background(FetsColor.paper)
    }

    private func attemptSignIn() {
        busy = true
        error = nil
        Task {
            let result = await session.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
            await MainActor.run {
                busy = false
                error = result
            }
        }
    }
}

struct FetsTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(FetsColor.deepTeal.opacity(0.35), lineWidth: 1)
            )
    }
}
