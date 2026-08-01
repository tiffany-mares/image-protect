package com.inkshield.auth.security;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtServiceTest {
    private final String secret = Base64.getEncoder().encodeToString(new byte[48]);
    private final JwtService jwt = new JwtService(secret);

    @Test
    void usesHs256PerContract() {
        String header = jwt.issue(UUID.randomUUID(), "a@b.com").split("\\.")[0];
        String decoded = new String(Base64.getUrlDecoder().decode(header));
        assertThat(decoded).contains("\"alg\":\"HS256\"");
    }

    @Test
    void issuesTokenWithSubEmailIatExp() {
        UUID id = UUID.randomUUID();
        String token = jwt.issue(id, "a@b.com");
        Claims c = jwt.parse(token);
        assertThat(c.getSubject()).isEqualTo(id.toString());
        assertThat(c.get("email", String.class)).isEqualTo("a@b.com");
        long lifetime = c.getExpiration().getTime() - c.getIssuedAt().getTime();
        assertThat(lifetime).isEqualTo(24L * 3600 * 1000);
    }

    @Test
    void rejectsTokenSignedWithDifferentKey() {
        byte[] other = new byte[48];
        other[0] = 1;
        JwtService attacker = new JwtService(Base64.getEncoder().encodeToString(other));
        String forged = attacker.issue(UUID.randomUUID(), "a@b.com");
        assertThrows(Exception.class, () -> jwt.parse(forged));
    }

    @Test
    void rejectsTamperedPayload() {
        String token = jwt.issue(UUID.randomUUID(), "a@b.com");
        String[] parts = token.split("\\.");
        String tamperedPayload = parts[1].charAt(0) == 'A'
                ? "B" + parts[1].substring(1)
                : "A" + parts[1].substring(1);
        String tampered = parts[0] + "." + tamperedPayload + "." + parts[2];
        assertThrows(Exception.class, () -> jwt.parse(tampered));
    }
}
