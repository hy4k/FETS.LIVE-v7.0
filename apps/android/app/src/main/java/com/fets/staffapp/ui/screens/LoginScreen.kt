package com.fets.staffapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fets.staffapp.ui.components.FetsMonogram
import com.fets.staffapp.ui.theme.FetsDeepTeal
import com.fets.staffapp.ui.theme.FetsDeepTealDark
import com.fets.staffapp.ui.theme.FetsGold
import com.fets.staffapp.ui.theme.FetsPaper
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(onSignIn: suspend (String, String) -> Result<Unit>) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(FetsPaper)
            .imePadding()
            .padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        FetsMonogram(size = 92)
        Spacer(Modifier.height(20.dp))
        Text(
            text = "FETS · LIVE",
            fontSize = 26.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 2.sp,
            color = FetsDeepTealDark,
        )
        Text(
            text = "Staff Command Centre",
            style = MaterialTheme.typography.bodyMedium,
            color = FetsDeepTealDark.copy(alpha = 0.55f),
        )
        Spacer(Modifier.height(36.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it; error = null },
            label = { Text("Work email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            shape = RoundedCornerShape(16.dp),
            colors = fetsFieldColors(),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it; error = null },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            shape = RoundedCornerShape(16.dp),
            colors = fetsFieldColors(),
            modifier = Modifier.fillMaxWidth(),
        )

        error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(28.dp))
        Button(
            onClick = {
                if (busy) return@Button
                busy = true
                error = null
                scope.launch {
                    val result = onSignIn(email.trim(), password)
                    result.onFailure { error = it.message ?: "Sign-in failed" }
                    busy = false
                }
            },
            enabled = !busy && email.isNotBlank() && password.isNotBlank(),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = FetsDeepTeal,
                contentColor = FetsGold,
            ),
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            if (busy) {
                CircularProgressIndicator(color = FetsGold, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
            } else {
                Text("Enter Workspace", fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
            }
        }
    }
}

@Composable
private fun fetsFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = FetsDeepTeal,
    focusedLabelColor = FetsDeepTeal,
    cursorColor = FetsDeepTeal,
)
