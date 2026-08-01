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

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private boolean verified = false;

    @Column(name = "verification_token")
    private String verificationToken;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected User() {}

    public User(String email, String passwordHash, String verificationToken) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.verificationToken = verificationToken;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public boolean isVerified() { return verified; }
    public String getVerificationToken() { return verificationToken; }
    public Instant getCreatedAt() { return createdAt; }

    public void markVerified() {
        this.verified = true;
        this.verificationToken = null;
    }
}
