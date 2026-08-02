package com.inkshield.auth.auth;

import com.inkshield.auth.email.EmailSender;
import com.inkshield.auth.security.GoogleTokenVerifier;
import com.inkshield.auth.security.JwtService;
import com.inkshield.auth.user.User;
import com.inkshield.auth.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository repo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final EmailSender email;
    private final GoogleTokenVerifier google;
    private final String frontendUrl;

    public AuthService(UserRepository repo, PasswordEncoder encoder, JwtService jwt,
                       EmailSender email, GoogleTokenVerifier google,
                       @Value("${app.frontend-url}") String frontendUrl) {
        this.repo = repo;
        this.encoder = encoder;
        this.jwt = jwt;
        this.email = email;
        this.google = google;
        this.frontendUrl = frontendUrl;
    }

    @Transactional
    public void signup(String emailAddr, String password) {
        if (repo.existsByEmail(emailAddr)) {
            throw new ApiException(HttpStatus.CONFLICT, "email already registered");
        }
        // No email verification: the account is usable immediately.
        User user = new User(emailAddr, encoder.encode(password), null);
        user.markVerified();
        repo.save(user);
    }

    @Transactional
    public void verify(String token) {
        User user = repo.findByVerificationToken(token)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "invalid or already-used token"));
        user.markVerified();
        repo.save(user);
    }

    @Transactional(readOnly = true)
    public String login(String emailAddr, String password) {
        User user = repo.findByEmail(emailAddr)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "bad credentials"));
        if (!encoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "bad credentials");
        }
        return jwt.issue(user.getId(), user.getEmail());
    }

    /**
     * Sign in (or transparently register) via a Google ID token. Google has
     * already verified the email, so the account is created pre-verified; an
     * existing unverified email/password account for the same address is
     * promoted to verified.
     */
    @Transactional
    public String loginWithGoogle(String credential) {
        String emailAddr = google.verify(credential);
        User user = repo.findByEmail(emailAddr).orElseGet(() -> User.oauth(emailAddr));
        if (!user.isVerified()) {
            user.markVerified();
        }
        user = repo.save(user);
        return jwt.issue(user.getId(), user.getEmail());
    }

    /**
     * Begin a password reset: if the email maps to an account, store a one-hour
     * token and email a reset link. Always returns quietly — callers must not be
     * able to tell whether an address is registered.
     */
    @Transactional
    public void forgotPassword(String emailAddr) {
        repo.findByEmail(emailAddr).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            user.startPasswordReset(token, Instant.now().plus(Duration.ofHours(1)));
            repo.save(user);
            try {
                email.sendPasswordReset(user.getEmail(), frontendUrl + "/reset-password?token=" + token);
            } catch (RuntimeException e) {
                // A delivery failure (e.g. the SES sandbox rejecting an unverified
                // recipient) must never surface to the caller or reveal whether the
                // account exists. The reset token is stored regardless.
                log.warn("password-reset email delivery failed: {}", e.getClass().getSimpleName());
            }
        });
    }

    /** Complete a password reset with a valid, unexpired token. */
    @Transactional
    public void resetPassword(String token, String newPassword) {
        User user = repo.findByResetToken(token)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "invalid or expired reset link"));
        Instant expires = user.getResetTokenExpires();
        if (expires == null || expires.isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid or expired reset link");
        }
        user.completePasswordReset(encoder.encode(newPassword));
        repo.save(user);
    }
}
