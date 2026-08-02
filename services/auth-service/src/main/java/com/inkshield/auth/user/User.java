package com.inkshield.auth.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue
    @UuidGenerator
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    // Nullable: OAuth (e.g. Google) accounts have no local password.
    @Column(name = "password_hash")
    private String passwordHash;

    @Column(nullable = false)
    private boolean verified = false;

    @Column(name = "reset_token")
    private String resetToken;

    @Column(name = "reset_token_expires")
    private Instant resetTokenExpires;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected User() {}

    public User(String email, String passwordHash) {
        this.email = email;
        this.passwordHash = passwordHash;
    }

    /** A pre-verified account for an OAuth (e.g. Google) sign-in — no local password. */
    public static User oauth(String email) {
        User u = new User();
        u.email = email;
        u.verified = true;
        return u;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public boolean isVerified() { return verified; }
    public Instant getCreatedAt() { return createdAt; }

    public void markVerified() {
        this.verified = true;
    }

    public String getResetToken() { return resetToken; }
    public Instant getResetTokenExpires() { return resetTokenExpires; }

    /** Begin a password reset: store a single-use token and its expiry. */
    public void startPasswordReset(String token, Instant expires) {
        this.resetToken = token;
        this.resetTokenExpires = expires;
    }

    /** Finish a password reset: set the new hash and invalidate the token. */
    public void completePasswordReset(String newPasswordHash) {
        this.passwordHash = newPasswordHash;
        this.resetToken = null;
        this.resetTokenExpires = null;
    }
}
