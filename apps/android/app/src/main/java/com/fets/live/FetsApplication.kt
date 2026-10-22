package com.fets.live

import android.app.Application
import com.fets.live.data.FetsRepository
import com.fets.live.data.SessionManager
import com.fets.live.data.SupabaseProvider

class FetsApplication : Application() {

    lateinit var repository: FetsRepository
        private set
    lateinit var session: SessionManager
        private set

    override fun onCreate() {
        super.onCreate()
        val client = SupabaseProvider.create()
        repository = FetsRepository(client)
        session = SessionManager(repository)
    }
}
