package com.fets.staffapp.ui

import androidx.compose.foundation.background
import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Construction
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.fets.staffapp.data.SessionManager
import com.fets.staffapp.data.SessionState
import com.fets.staffapp.data.StaffProfile
import com.fets.staffapp.ui.components.FetsBottomBar
import com.fets.staffapp.ui.components.LoadingBlock
import com.fets.staffapp.ui.components.NavTab
import com.fets.staffapp.ui.screens.AiScreen
import com.fets.staffapp.ui.screens.CalendarScreen
import com.fets.staffapp.ui.screens.CandidatesScreen
import com.fets.staffapp.ui.screens.CasesScreen
import com.fets.staffapp.ui.screens.HomeScreen
import com.fets.staffapp.ui.screens.LoginScreen
import com.fets.staffapp.ui.screens.NewCaseScreen
import com.fets.staffapp.ui.screens.OnDutyScreen
import com.fets.staffapp.ui.screens.ProfileScreen

object Routes {
    const val HOME = "home"
    const val CALENDAR = "calendar"
    const val CASES = "cases"
    const val NEW_CASE = "cases/new"
    const val AI = "ai"
    const val PROFILE = "profile"
    const val ON_DUTY = "onduty"
    const val CANDIDATES = "candidates"
}

private val mainTabs = listOf(
    NavTab(Routes.HOME, "Home", Icons.Outlined.Home),
    NavTab(Routes.CALENDAR, "Calendar", Icons.Outlined.CalendarMonth),
    NavTab(Routes.CASES, "Cases", Icons.Outlined.Construction),
    NavTab(Routes.AI, "AI", Icons.Outlined.Psychology),
    NavTab(Routes.PROFILE, "Profile", Icons.Outlined.Person),
)

@Composable
fun AppRoot(session: SessionManager) {
    val state by session.state.collectAsState()
    LaunchedEffect(Unit) { session.restore() }
    when (val s = state) {
        SessionState.Loading -> Box(
            Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background),
        ) { LoadingBlock("Getting your workspace ready…") }
        SessionState.SignedOut -> LoginScreen(onSignIn = { email, password ->
            session.signIn(email, password)
        })
        is SessionState.SignedIn -> MainScaffold(session, s.profile)
    }
}

@Composable
private fun MainScaffold(session: SessionManager, profile: StaffProfile) {
    val nav = rememberNavController()
    val backStackEntry by nav.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val showNavBar = currentRoute in mainTabs.map { it.route }

    Scaffold(
        bottomBar = {
            if (showNavBar) {
                FetsBottomBar(
                    tabs = mainTabs,
                    currentRoute = currentRoute,
                    onSelect = { route ->
                        nav.navigate(route) {
                            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = Routes.HOME,
            modifier = Modifier.padding(padding),
        ) {
            composable(Routes.HOME) {
                HomeScreen(
                    session = session,
                    profile = profile,
                    onOpenCase = { nav.navigate(Routes.NEW_CASE) },
                    onOpenOnDuty = { nav.navigate(Routes.ON_DUTY) },
                    onOpenCandidates = { nav.navigate(Routes.CANDIDATES) },
                    onOpenAi = { nav.navigate(Routes.AI) },
                    onOpenCases = { nav.navigate(Routes.CASES) },
                )
            }
            composable(Routes.CALENDAR) { CalendarScreen(session) }
            composable(Routes.CASES) {
                CasesScreen(session = session, onNewCase = { nav.navigate(Routes.NEW_CASE) })
            }
            composable(Routes.NEW_CASE) {
                NewCaseScreen(session = session, profile = profile, onDone = { nav.popBackStack() })
            }
            composable(Routes.AI) { AiScreen(session) }
            composable(Routes.PROFILE) { ProfileScreen(session = session, profile = profile) }
            composable(Routes.ON_DUTY) { OnDutyScreen(session) }
            composable(Routes.CANDIDATES) { CandidatesScreen(session) }
        }
    }
}
