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

import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
        svc = new AuthService(repo, encoder, jwt, email, mock(GoogleTokenVerifier.class),
                "http://localhost:8080");
    }

    @Test
    void signupHashesPasswordAndCreatesVerifiedAccount() {
        when(repo.existsByEmail("a@b.com")).thenReturn(false);
        svc.signup("a@b.com", "hunter22");
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(repo).save(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getPasswordHash()).isNotEqualTo("hunter22");
        assertThat(encoder.matches("hunter22", saved.getPasswordHash())).isTrue();
        // No email verification: the account is created ready to use.
        assertThat(saved.isVerified()).isTrue();
    }

    @Test
    void signupDuplicateIs409() {
        when(repo.existsByEmail("a@b.com")).thenReturn(true);
        assertThatThrownBy(() -> svc.signup("a@b.com", "x"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
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
        User u = new User("a@b.com", encoder.encode("right"));
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        assertThatThrownBy(() -> svc.login("a@b.com", "wrong"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void loginReturnsJwt() {
        User u = new User("a@b.com", encoder.encode("pw"));
        java.util.UUID id = java.util.UUID.randomUUID();
        org.springframework.test.util.ReflectionTestUtils.setField(u, "id", id);
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        String token = svc.login("a@b.com", "pw");
        assertThat(jwt.parse(token).getSubject()).isEqualTo(id.toString());
        assertThat(jwt.parse(token).get("email", String.class)).isEqualTo("a@b.com");
    }

    @Test
    void forgotPasswordKnownUserStoresTokenAndEmailsLink() {
        User u = new User("a@b.com", encoder.encode("pw"));
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        svc.forgotPassword("a@b.com");
        assertThat(u.getResetToken()).isNotBlank();
        assertThat(u.getResetTokenExpires()).isAfter(Instant.now());
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(email).sendPasswordReset(eq("a@b.com"), link.capture());
        assertThat(link.getValue()).contains("/reset-password?token=" + u.getResetToken());
    }

    @Test
    void forgotPasswordUnknownEmailIsSilent() {
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.empty());
        svc.forgotPassword("a@b.com");
        verify(email, never()).sendPasswordReset(any(), any());
    }

    @Test
    void forgotPasswordSwallowsEmailDeliveryFailure() {
        User u = new User("a@b.com", encoder.encode("pw"));
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(u));
        doThrow(new RuntimeException("SES rejected")).when(email).sendPasswordReset(any(), any());
        // Must not throw even though delivery failed, and the token is still stored.
        svc.forgotPassword("a@b.com");
        assertThat(u.getResetToken()).isNotBlank();
    }

    @Test
    void resetPasswordUpdatesHashAndClearsToken() {
        User u = new User("a@b.com", encoder.encode("old"));
        u.startPasswordReset("tok", Instant.now().plus(Duration.ofMinutes(30)));
        when(repo.findByResetToken("tok")).thenReturn(Optional.of(u));
        svc.resetPassword("tok", "brandnew1");
        assertThat(encoder.matches("brandnew1", u.getPasswordHash())).isTrue();
        assertThat(u.getResetToken()).isNull();
        assertThat(u.getResetTokenExpires()).isNull();
        verify(repo).save(u);
    }

    @Test
    void resetPasswordExpiredTokenIs400() {
        User u = new User("a@b.com", encoder.encode("old"));
        u.startPasswordReset("tok", Instant.now().minus(Duration.ofMinutes(1)));
        when(repo.findByResetToken("tok")).thenReturn(Optional.of(u));
        assertThatThrownBy(() -> svc.resetPassword("tok", "brandnew1"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void resetPasswordUnknownTokenIs400() {
        when(repo.findByResetToken("nope")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.resetPassword("nope", "brandnew1"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
