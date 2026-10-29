package com.fets.staffapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The scaffold declared com.fets.live at versionCode 8. The published listing is
 * com.fets.staffapp and Production was on 34, so that build could not have
 * updated the app even if it had been perfect — it would have created a second,
 * empty listing. apps/README.md asserted the opposite.
 *
 * These are cheap tests for an expensive mistake: the kind only discovered at
 * the moment of release.
 */
class ReleaseIdentityTest {

    @Test
    fun `application id matches the published listing`() {
        // the debug variant carries a .debug suffix so it installs alongside production
        assertEquals("com.fets.staffapp", BuildConfig.APPLICATION_ID.removeSuffix(".debug"))
    }

    @Test
    fun `version code exceeds the live release`() {
        assertTrue(
            "versionCode ${BuildConfig.VERSION_CODE} must exceed the published 34",
            BuildConfig.VERSION_CODE > 34,
        )
    }

    @Test
    fun `version name is the native rewrite`() {
        assertEquals("3.0.0", BuildConfig.VERSION_NAME)
    }
}
