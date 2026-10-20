package com.fets.live.ui.screens

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.outlined.Business
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Work
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fets.live.data.BranchStatus
import com.fets.live.data.SessionManager
import com.fets.live.data.StaffProfile
import com.fets.live.data.UiState
import com.fets.live.ui.components.SectionTitle
import com.fets.live.ui.theme.FetsDeepTeal
import com.fets.live.ui.theme.FetsDeepTealDark
import com.fets.live.ui.theme.FetsGold
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(session: SessionManager, profile: StaffProfile) {
    val branch by session.activeBranch.collectAsState()
    var branchRows by remember { mutableStateOf<UiState<List<BranchStatus>>>(UiState.Loading) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        branchRows = UiState.Ready(session.repository.loadBranchStatus())
    }

    val branches = listOf(
        Triple("global", "Global View", Icons.Outlined.Public),
        Triple("calicut", "Calicut HQ", Icons.Outlined.Business),
        Triple("cochin", "Cochin Center", Icons.Outlined.Business),
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(FetsDeepTeal),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        profile.fullName.trim().split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString(""),
                        color = FetsGold,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                    )
                }
                Spacer(Modifier.padding(8.dp))
                Column(Modifier.padding(start = 8.dp)) {
                    Text(
                        profile.fullName.ifBlank { "Staff Member" },
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color = FetsDeepTealDark,
                    )
                    Text(
                        profile.email,
                        style = MaterialTheme.typography.bodySmall,
                        color = FetsDeepTealDark.copy(alpha = 0.55f),
                    )
                }
            }
        }

        item {
            Card(shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(4.dp)) {
                    ProfileRow(Icons.Outlined.Work, "Role", profile.role.replace('_', ' '))
                    ProfileRow(Icons.Outlined.Business, "Assigned centre", profile.branchAssigned ?: "—")
                    ProfileRow(Icons.Outlined.CheckCircle, "Status", "Active")
                }
            }
        }

        item { SectionTitle("Working Centre") }
        item {
            Card(shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(4.dp)) {
                    branches.forEach { (id, label, icon) ->
                        val selected = branch == id
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (selected) FetsGold.copy(alpha = 0.16f) else Color.Transparent
                                )
                                .clickable { session.setBranch(id) }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                icon,
                                contentDescription = null,
                                tint = if (selected) FetsDeepTeal else FetsDeepTealDark.copy(alpha = 0.5f),
                                modifier = Modifier.size(20.dp),
                            )
                            Spacer(Modifier.padding(6.dp))
                            Text(
                                label,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                color = FetsDeepTealDark,
                                modifier = Modifier.weight(1f).padding(start = 6.dp),
                            )
                            if (selected) {
                                Icon(
                                    Icons.Outlined.CheckCircle,
                                    contentDescription = "Active",
                                    tint = FetsDeepTeal,
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            Button(
                onClick = { scope.launch { session.signOut() } },
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFFEE2E2),
                    contentColor = Color(0xFFB91C1C),
                ),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) {
                Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null)
                Spacer(Modifier.padding(4.dp))
                Text("Sign Out", fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun ProfileRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = FetsDeepTeal.copy(alpha = 0.6f), modifier = Modifier.size(20.dp))
        Spacer(Modifier.padding(6.dp))
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = FetsDeepTealDark.copy(alpha = 0.55f),
            modifier = Modifier.weight(1f).padding(start = 6.dp),
        )
        Text(
            value.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            color = FetsDeepTealDark,
        )
    }
}
