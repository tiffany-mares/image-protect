package com.inkshield.auth.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inkshield.auth.auth.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;

/**
 * Verifies a Google Identity Services ID token via Google's tokeninfo endpoint
 * and returns the authenticated email. Google validates the token's signature,
 * issuer and expiry; we additionally pin the audience to our own OAuth client id
 * and require a verified email. Throws {@link ApiException} on any failure.
 */
@Component
public class GoogleTokenVerifier {
    private static final String TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?id_token=";
    private static final Set<String> ISSUERS =
            Set.of("accounts.google.com", "https://accounts.google.com");

    private final String clientId;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public GoogleTokenVerifier(@Value("${app.google-client-id:}") String clientId) {
        this.clientId = clientId;
    }

    /** @return the verified email for a valid Google ID token. */
    public String verify(String idToken) {
        if (clientId == null || clientId.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "google sign-in is not configured");
        }

        JsonNode claims;
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(TOKENINFO + URLEncoder.encode(idToken, StandardCharsets.UTF_8)))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid google token");
            }
            claims = mapper.readTree(res.body());
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "could not reach google to verify sign-in");
        }

        String aud = claims.path("aud").asText("");
        String iss = claims.path("iss").asText("");
        String email = claims.path("email").asText("");
        boolean emailVerified =
                "true".equalsIgnoreCase(claims.path("email_verified").asText("false"));

        if (!clientId.equals(aud)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "google token audience mismatch");
        }
        if (!ISSUERS.contains(iss)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unexpected google token issuer");
        }
        if (email.isBlank() || !emailVerified) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "google account email not verified");
        }
        return email.toLowerCase();
    }
}
