package com.inkshield.auth.auth;

import com.inkshield.auth.email.EmailSender;
import com.inkshield.auth.security.JwtService;
import com.inkshield.auth.user.User;
import com.inkshield.auth.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository repo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final EmailSender email;

    public AuthService(UserRepository repo, PasswordEncoder encoder, JwtService jwt, EmailSender email) {
        this.repo = repo;
        this.encoder = encoder;
        this.jwt = jwt;
        this.email = email;
    }

    @Transactional
    public void signup(String emailAddr, String password) {
        if (repo.existsByEmail(emailAddr)) {
            throw new ApiException(HttpStatus.CONFLICT, "email already registered");
        }
        String token = UUID.randomUUID().toString();
        User user = repo.save(new User(emailAddr, encoder.encode(password), token));
        email.sendVerification(user.getEmail(), token);
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
        if (!user.isVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "email not verified");
        }
        return jwt.issue(user.getId(), user.getEmail());
    }
}
