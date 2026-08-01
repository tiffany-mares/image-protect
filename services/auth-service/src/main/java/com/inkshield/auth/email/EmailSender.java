package com.inkshield.auth.email;

public interface EmailSender {
    void sendVerification(String toEmail, String token);
}
