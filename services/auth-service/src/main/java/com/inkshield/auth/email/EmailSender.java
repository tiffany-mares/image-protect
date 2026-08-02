package com.inkshield.auth.email;

public interface EmailSender {
    void sendVerification(String toEmail, String token);

    /** Send a password-reset email. {@code link} is the full frontend reset URL. */
    void sendPasswordReset(String toEmail, String link);
}
