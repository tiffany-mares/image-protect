package com.inkshield.auth.auth;

import com.inkshield.auth.email.EmailSender;
import com.inkshield.auth.security.GoogleTokenVerifier;
import com.inkshield.auth.security.JwtService;
import com.inkshield.auth.user.User;
import com.inkshield.auth.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {
    private UserRepository repo;
    private EmailSender email;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final JwtService jwt = new JwtService(Base64.getEncoder().encodeToString(new byte[48]));
    private AuthService svc;

    @BeforeEach
    void setUp() {
        repo = mock(UserRepository.class);
        email = mock(EmailSender.class);
        when(repo.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        svc = new AuthService(repo, encoder, jwt, email, mock(GoogleTokenVerifier.class));
    }

    @Test
    void signupHashesPasswordAndSendsEmail() {
        when(repo.existsByEmail("a@b.com")).thenReturn(false);
        svc.signup("a@b.com", "hunter22");
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(repo).save(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getPasswordHash()).isNotEqualTo("hunter22");
        assertThat(encoder.matches("hunter22", saved.getPasswordHash())).isTrue();
        assertThat(saved.isVerified()).isFalse();
        assertThat(saved.getVerificationToken()).isNotBlank();
        verify(email).sendVerification(eq("a@b.com"), eq(saved.getVerificationToken()));
    }

    @Test
    void signupDuplicateIs409() {
        when(repo.existsByEmail("a@b.com")).thenReturn(true);
        assertThatThrownBy(() -> svc.signup("a@b.com", "x"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void verifyMarksUserVerified() {
        User u = new User("a@b.com", "h", "tok123");
        when(repo.findByVerificationToken("tok123")).thenReturn(Optional.of(u));
        svc.verify("tok123");
        assertThat(u.isVerified()).isTrue();
        assertThat(u.getVerificationToken()).isNull();
        verify(repo).save(u);
    }

    @Test
    void verifyBadTokenIs400() {
        when(repo.findByVerificationToken("nope")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.verify("nope"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void loginUnknownEmailIs401() {
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.login("a@b.com", "x"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void loginWrongPasswordIs401() {
        User u = new User("a@b.com", encoder.encode("right"), null);
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        assertThatThrownBy(() -> svc.login("a@b.com", "wrong"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void loginUnverifiedIs403() {
        User u = new User("a@b.com", encoder.encode("pw"), "tok");
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        assertThatThrownBy(() -> svc.login("a@b.com", "pw"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void loginVerifiedReturnsJwt() {
        User u = new User("a@b.com", encoder.encode("pw"), "tok");
        u.markVerified();
        java.util.UUID id = java.util.UUID.randomUUID();
        org.springframework.test.util.ReflectionTestUtils.setField(u, "id", id);
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        String token = svc.login("a@b.com", "pw");
        assertThat(jwt.parse(token).getSubject()).isEqualTo(id.toString());
        assertThat(jwt.parse(token).get("email", String.class)).isEqualTo("a@b.com");
    }
}
