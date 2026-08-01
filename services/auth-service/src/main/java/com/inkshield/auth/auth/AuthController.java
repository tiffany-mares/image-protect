package com.inkshield.auth.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) { this.auth = auth; }

    public record SignupRequest(@Email @NotBlank String email, @NotBlank @Size(min = 8) String password) {}
    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> signup(@RequestBody @Valid SignupRequest req) {
        auth.signup(req.email(), req.password());
        return Map.of("message", "check your email for a verification link");
    }

    @GetMapping("/verify")
    public Map<String, String> verify(@RequestParam String token) {
        auth.verify(token);
        return Map.of("message", "email verified — you can now log in");
    }

    @PostMapping("/login")
    public Map<String, String> login(@RequestBody @Valid LoginRequest req) {
        return Map.of("token", auth.login(req.email(), req.password()));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> apiError(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> validationError(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", "invalid request body"));
    }
}
