package com.fets.staffapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fets.staffapp.data.CASE_CATEGORIES
import com.fets.staffapp.data.SessionManager
import com.fets.staffapp.data.StaffProfile
import com.fets.staffapp.ui.theme.FetsDeepTeal
import com.fets.staffapp.ui.theme.FetsDeepTealDark
import com.fets.staffapp.ui.theme.FetsGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewCaseScreen(
    session: SessionManager,
    profile: StaffProfile,
    onDone: () -> Unit,
) {
    val branch by session.activeBranch.collectAsState()
    var category by remember { mutableStateOf(CASE_CATEGORIES.first().id) }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Open a Case", fontWeight = FontWeight.ExtraBold, color = FetsDeepTealDark)
                },
                navigationIcon = {
                    IconButton(onClick = onDone) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Text(
                    "CATEGORY",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.6.sp,
                    color = FetsDeepTeal.copy(alpha = 0.7f),
                )
                Spacer(Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(CASE_CATEGORIES, key = { it.id }) { cat ->
                        val selected = category == cat.id
                        val tint = Color(cat.color)
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (selected) FetsDeepTeal else MaterialTheme.colorScheme.surface,
                            ),
                            modifier = Modifier.clickable { category = cat.id },
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(tint),
                                )
                                Spacer(Modifier.size(8.dp))
                                Text(
                                    cat.label,
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.Bold,
                                    color = if (selected) FetsGold else FetsDeepTealDark,
                                )
                            }
                        }
                    }
                }
            }

            item {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it; error = null },
                    label = { Text("Title") },
                    placeholder = { Text("Short summary of the issue") },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    colors = caseFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it; error = null },
                    label = { Text("Description") },
                    placeholder = { Text("What happened? Who is affected?") },
                    minLines = 4,
                    shape = RoundedCornerShape(14.dp),
                    colors = caseFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            error?.let {
                item {
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }

            item {
                Button(
                    onClick = {
                        if (busy) return@Button
                        busy = true
                        error = null
                        scope.launch {
                            val result = session.repository.openCase(
                                profile = profile,
                                branch = branch,
                                title = title.trim(),
                                description = description.trim(),
                                category = category,
                                metadata = emptyMap(),
                            )
                            result
                                .onSuccess { onDone() }
                                .onFailure { error = it.message ?: "Could not open the case" }
                            busy = false
                        }
                    },
                    enabled = !busy && title.isNotBlank(),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = FetsDeepTeal,
                        contentColor = FetsGold,
                    ),
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                ) {
                    if (busy) {
                        CircularProgressIndicator(color = FetsGold, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Open Case", fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun caseFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = FetsDeepTeal,
    focusedLabelColor = FetsDeepTeal,
    cursorColor = FetsDeepTeal,
)
