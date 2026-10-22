package com.fets.live.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.fets.live.data.Incident
import com.fets.live.data.SessionManager
import com.fets.live.data.UiState
import com.fets.live.ui.components.EmptyState
import com.fets.live.ui.components.LoadingBlock
import com.fets.live.ui.components.SectionTitle
import com.fets.live.ui.components.StatusChip
import com.fets.live.ui.theme.FetsDeepTeal
import com.fets.live.ui.theme.FetsGold

@Composable
fun CasesScreen(session: SessionManager, onNewCase: () -> Unit) {
    val branch by session.activeBranch.collectAsState()
    var cases by remember { mutableStateOf<UiState<List<Incident>>>(UiState.Loading) }
    var filter by remember { mutableStateOf("all") }

    LaunchedEffect(branch) {
        cases = UiState.Loading
        cases = UiState.Ready(session.repository.loadCases(branch))
    }

    val filters = listOf("all", "open", "in_progress", "closed")

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNewCase,
                containerColor = FetsDeepTeal,
                contentColor = FetsGold,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Open a case")
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SectionTitle("Cases · Floor Log")
                    Icon(
                        Icons.Outlined.FilterList,
                        contentDescription = null,
                        tint = FetsDeepTeal.copy(alpha = 0.5f),
                    )
                }
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    filters.forEach { f ->
                        FilterChip(
                            selected = filter == f,
                            onClick = { filter = f },
                            label = {
                                Text(
                                    f.replace('_', ' '),
                                    style = MaterialTheme.typography.labelMedium,
                                )
                            },
                        )
                    }
                }
            }

            when (val s = cases) {
                UiState.Loading -> item { LoadingBlock("Pulling the case log…") }
                is UiState.Error -> item { EmptyState(Icons.Outlined.FilterList, "Could not load", s.message) }
                is UiState.Ready -> {
                    val visible = s.data.filter { filter == "all" || it.status == filter }
                    if (visible.isEmpty()) {
                        item {
                            EmptyState(
                                Icons.Outlined.FilterList,
                                "No ${filter.replace('_', ' ')} cases",
                                "New cases opened from the app appear here instantly.",
                            )
                        }
                    } else {
                        items(visible, key = { it.id }) { IncidentRow(it) }
                    }
                }
            }
        }
    }
}
