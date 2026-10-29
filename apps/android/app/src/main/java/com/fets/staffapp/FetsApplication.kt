package com.fets.staffapp

import android.app.Application
import com.fets.staffapp.data.FetsRepository
import com.fets.staffapp.data.SessionManager
import com.fets.staffapp.data.SupabaseProvider

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
