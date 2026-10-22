package com.fets.live.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface SessionState {
    data object Loading : SessionState
    data object SignedOut : SessionState
    data class SignedIn(val profile: StaffProfile) : SessionState
}

class SessionManager(val repository: FetsRepository) {

    private val _state = MutableStateFlow<SessionState>(SessionState.Loading)
    val state: StateFlow<SessionState> = _state.asStateFlow()

    private val _activeBranch = MutableStateFlow("global")
    val activeBranch: StateFlow<String> = _activeBranch.asStateFlow()

    suspend fun restore() {
        val session = runCatching { repository.client.auth.currentSessionOrNull() }.getOrNull()
        val user = session?.user
        if (user == null) {
            _state.value = SessionState.SignedOut
        } else {
            _state.value = SessionState.SignedIn(repository.loadProfile(user.id))
        }
    }

    suspend fun signIn(email: String, password: String): Result<Unit> = runCatching {
        repository.client.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
        val user = repository.client.auth.currentUserOrNull()
            ?: throw IllegalStateException("Sign-in failed. Check your email and password.")
        _state.value = SessionState.SignedIn(repository.loadProfile(user.id))
    }

    suspend fun signOut() {
        runCatching { repository.client.auth.signOut() }
        _state.value = SessionState.SignedOut
    }

    fun setBranch(branch: String) {
        _activeBranch.value = branch
    }
}
