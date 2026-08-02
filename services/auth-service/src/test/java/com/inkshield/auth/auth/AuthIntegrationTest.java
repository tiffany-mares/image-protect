package com.inkshield.auth.auth;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.inkshield.auth.email.EmailSender;
import com.inkshield.auth.security.JwtService;
import com.inkshield.auth.user.UserRepository;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration test against a real Postgres started manually (Testcontainers is
 * incompatible with the installed Docker Desktop 29 npipe transport as of 1.21.3).
 *
 * Prerequisite — start the test database once:
 *   docker run -d --name auth-it-pg -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16-alpine
 *
 * schema.sql drops and recreates the users table on every context start, so runs are repeatable.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:55432/postgres",
        "spring.datasource.username=postgres",
        "spring.datasource.password=test",
        "app.jwt-secret=c2VjcmV0LXNlY3JldC1zZWNyZXQtc2VjcmV0LXNlY3JldC1zZWNyZXQtc2VjcmV0",
        "spring.sql.init.mode=always"
})
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository repo;
    @Autowired JwtService jwt;
    @MockitoBean EmailSender emailSender;

    @Test
    @Order(1)
    void fullSignupLoginFlow() throws Exception {
        mvc.perform(post("/auth/signup").contentType("application/json")
                        .content("{\"email\":\"artist@example.com\",\"password\":\"hunter2222\"}"))
                .andExpect(status().isCreated());

        // No email verification: the account is usable immediately, so login succeeds.
        String body = mvc.perform(post("/auth/login").contentType("application/json")
                        .content("{\"email\":\"artist@example.com\",\"password\":\"hunter2222\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String jwtToken = JsonMapper.builder().build().readTree(body).get("token").asText();
        var claims = jwt.parse(jwtToken);
        assertThat(claims.get("email", String.class)).isEqualTo("artist@example.com");
        assertThat(claims.getSubject())
                .isEqualTo(repo.findByEmail("artist@example.com").orElseThrow().getId().toString());
    }

    @Test
    @Order(2)
    void duplicateSignupIs409AndBadBodiesAre400() throws Exception {
        mvc.perform(post("/auth/signup").contentType("application/json")
                        .content("{\"email\":\"artist@example.com\",\"password\":\"hunter2222\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/auth/signup").contentType("application/json")
                        .content("{\"email\":\"not-an-email\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }
}
