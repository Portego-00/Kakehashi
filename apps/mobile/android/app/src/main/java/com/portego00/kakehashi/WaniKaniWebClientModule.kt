package com.portego00.kakehashi

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.FormBody
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.ConcurrentHashMap

class WaniKaniWebClientModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WaniKaniWebClientBridge"

    companion object {
        private const val TAG = "WaniKaniWebClient"
        private const val SESSION_COOKIE_NAME = "_wanikani_session"
        private const val LOGIN_URL = "https://www.wanikani.com/login"
        private const val ACCESS_TOKEN_URL = "https://www.wanikani.com/settings/personal_access_tokens"
        private const val API_TOKEN_DESCRIPTION = "Kakehashi"

        private val CSRF_TOKEN_REGEX =
            Regex("""<meta name="csrf-token" content="([^"]*)""")
        private val API_TOKEN_REGEX =
            Regex(""">\s*${Regex.escape(API_TOKEN_DESCRIPTION)}\s*</.*?<code[^>]*>([a-f0-9-]{36})</code>""", RegexOption.DOT_MATCHES_ALL)
    }

    @ReactMethod
    fun login(email: String, password: String, promise: Promise) {
        Thread {
            try {
                val result = performLogin(email, password)
                val map = Arguments.createMap()
                map.putString("cookie", result.cookie)
                map.putString("apiToken", result.apiToken)
                promise.resolve(map)
            } catch (e: WaniKaniException) {
                Log.e(TAG, "Login failed: ${e.message}", e)
                promise.reject("WANIKANI_ERROR", e.message, e)
            } catch (e: Exception) {
                Log.e(TAG, "Login failed with unexpected error", e)
                promise.reject("UNKNOWN_ERROR", "An unknown error occurred", e)
            }
        }.start()
    }

    private fun performLogin(email: String, password: String): LoginResult {
        // Use cookie jar client for the login flow only
        val cookieJar = InMemoryCookieJar()
        val loginClient = OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .followRedirects(true)
            .build()

        // Plain client for authorized requests (manual Cookie header, no jar conflicts)
        val plainClient = OkHttpClient.Builder()
            .followRedirects(true)
            .build()

        // Step 1: GET the login page to extract CSRF token + session cookie
        Log.d(TAG, "GET $LOGIN_URL")
        val loginPageRequest = Request.Builder()
            .url(LOGIN_URL)
            .get()
            .build()

        val loginPageResponse = loginClient.newCall(loginPageRequest).execute()
        val loginPageBody = loginPageResponse.body?.string()
            ?: throw WaniKaniException("Failed to load login page")
        loginPageResponse.close()
        Log.d(TAG, "Login page loaded, length=${loginPageBody.length}")

        val csrfToken = extractCSRFToken(loginPageBody)
        Log.d(TAG, "CSRF token extracted: ${csrfToken.take(10)}...")

        val firstCookie = cookieJar.getSessionCookie()
            ?: throw WaniKaniException("Session cookie not set")
        Log.d(TAG, "First session cookie: ${firstCookie.take(10)}...")

        // Step 2: POST login credentials
        Log.d(TAG, "POST $LOGIN_URL")
        val loginFormBody = FormBody.Builder()
            .add("user[email]", email)
            .add("user[password]", password)
            .add("user[remember_me]", "0")
            .add("authenticity_token", csrfToken)
            .build()

        val loginRequest = Request.Builder()
            .url(LOGIN_URL)
            .post(loginFormBody)
            .build()

        val loginResponse = loginClient.newCall(loginRequest).execute()
        val loginResponseBody = loginResponse.body?.string() ?: ""
        val loginResponseUrl = loginResponse.request.url.toString()
        loginResponse.close()
        Log.d(TAG, "Login POST response URL: $loginResponseUrl")

        // Step 3: Validate login succeeded
        val secondCookie = cookieJar.getSessionCookie()
            ?: throw WaniKaniException("Session cookie not set")
        Log.d(TAG, "Second session cookie: ${secondCookie.take(10)}...")
        Log.d(TAG, "Cookies changed: ${firstCookie != secondCookie}")

        if (firstCookie == secondCookie) {
            throw WaniKaniException("Incorrect email or password")
        }
        if (loginResponseUrl == LOGIN_URL && loginResponseBody.contains("Invalid login or password")) {
            throw WaniKaniException("Incorrect email or password")
        }
        Log.d(TAG, "Login succeeded")

        // Step 4: Get or create API token using plain client
        val apiToken = getApiToken(plainClient, secondCookie)
        Log.d(TAG, "Got API token: ${apiToken.take(8)}...")

        return LoginResult(cookie = secondCookie, apiToken = apiToken)
    }

    private fun getApiToken(client: OkHttpClient, cookie: String): String {
        Log.d(TAG, "GET $ACCESS_TOKEN_URL")
        val request = authorizedRequest(ACCESS_TOKEN_URL, cookie)
        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: ""
        val responseUrl = response.request.url.toString()
        response.close()
        Log.d(TAG, "Token page response URL: $responseUrl, length=${body.length}")

        extractApiToken(body)?.let {
            Log.d(TAG, "Found existing API token")
            return it
        }

        Log.d(TAG, "No existing token found, creating one...")
        return createApiToken(client, cookie, responseUrl, body)
    }

    private fun createApiToken(client: OkHttpClient, cookie: String, getTokenPageUrl: String, getTokenPageBody: String): String {
        // We already have the page from getApiToken, reuse it for CSRF
        val csrfToken = extractCSRFToken(getTokenPageBody)
        Log.d(TAG, "CSRF token for create: ${csrfToken.take(10)}...")

        // POST to create the token
        Log.d(TAG, "POST $ACCESS_TOKEN_URL (create token)")
        val formBody = FormBody.Builder()
            .add("description", API_TOKEN_DESCRIPTION)
            .add("permissions[assignments][start]", "0")
            .add("permissions[assignments][start]", "1")
            .add("permissions[reviews][create]", "0")
            .add("permissions[reviews][create]", "1")
            .add("permissions[study_materials][create]", "0")
            .add("permissions[study_materials][create]", "1")
            .add("permissions[study_materials][update]", "0")
            .add("permissions[study_materials][update]", "1")
            .add("permissions[user][update]", "0")
            .add("authenticity_token", csrfToken)
            .add("button", "")
            .build()

        val createRequest = Request.Builder()
            .url(ACCESS_TOKEN_URL)
            .header("Cookie", "$SESSION_COOKIE_NAME=$cookie")
            .post(formBody)
            .build()

        val createResponse = client.newCall(createRequest).execute()
        val createBody = createResponse.body?.string() ?: ""
        val responseUrl = createResponse.request.url.toString()
        createResponse.close()
        Log.d(TAG, "Create token response URL: $responseUrl, length=${createBody.length}")

        extractApiToken(createBody)?.let {
            Log.d(TAG, "Created new API token")
            return it
        }

        if (responseUrl.contains("hibernation")) {
            throw WaniKaniException("Account is in hibernation mode")
        }

        // Include diagnostic info in the error so it shows in RN console
        val hasTokenDescription = createBody.contains(API_TOKEN_DESCRIPTION)
        val hasCode = createBody.contains("<code")
        val snippet = createBody.take(300).replace("\n", " ")
        throw WaniKaniException(
            "API token not found. " +
            "getTokenPage URL=$getTokenPageUrl, " +
            "createResponse URL=$responseUrl, " +
            "createBody length=${createBody.length}, " +
            "hasTokenDescription=$hasTokenDescription, hasCode=$hasCode, " +
            "snippet=$snippet"
        )
    }

    private fun authorizedRequest(url: String, cookie: String): Request {
        return Request.Builder()
            .url(url)
            .header("Cookie", "$SESSION_COOKIE_NAME=$cookie")
            .get()
            .build()
    }

    private fun extractCSRFToken(html: String): String {
        return CSRF_TOKEN_REGEX.find(html)?.groupValues?.get(1)
            ?: throw WaniKaniException("CSRF token not found")
    }

    private fun extractApiToken(html: String): String? {
        val result = API_TOKEN_REGEX.find(html)?.groupValues?.get(1)
        if (result == null) {
            Log.d(TAG, "API token regex did not match. HTML contains token description: ${html.contains(API_TOKEN_DESCRIPTION)}")
            Log.d(TAG, "HTML contains '<code': ${html.contains("<code")}")
        }
        return result
    }

    private data class LoginResult(val cookie: String, val apiToken: String)

    private class WaniKaniException(message: String) : Exception(message)

    private class InMemoryCookieJar : CookieJar {
        private val store = ConcurrentHashMap<String, MutableList<Cookie>>()

        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
            store.getOrPut(url.host) { mutableListOf() }.apply {
                cookies.forEach { newCookie ->
                    removeAll { it.name == newCookie.name }
                    add(newCookie)
                }
            }
        }

        override fun loadForRequest(url: HttpUrl): List<Cookie> {
            return store[url.host] ?: emptyList()
        }

        fun getSessionCookie(): String? {
            return store.values.flatten()
                .firstOrNull { it.name == SESSION_COOKIE_NAME }
                ?.value
        }
    }
}
