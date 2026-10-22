package com.fets.live

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.fets.live.ui.AppRoot
import com.fets.live.ui.theme.FetsTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as FetsApplication
        setContent {
            FetsTheme {
                AppRoot(session = app.session)
            }
        }
    }
}
