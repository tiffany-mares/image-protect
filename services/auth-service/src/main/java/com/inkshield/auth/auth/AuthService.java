package com.inkshield.auth.auth;

import com.inkshield.auth.email.EmailSender;
import com.inkshield.auth.security.GoogleTokenVerifier;
import com.inkshield.auth.security.JwtService;
import com.inkshield.auth.user.User;
import com.inkshield.auth.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository repo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final EmailSender email;
    private final GoogleTokenVerifier google;

    public AuthService(UserRepository repo, PasswordEncoder encoder, JwtService jwt,
                       EmailSender email, GoogleTokenVerifier google) {
        this.repo = repo;
        this.encoder = encoder;
        this.jwt = jwt;
        this.email = email;
        this.google = google;
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
}
