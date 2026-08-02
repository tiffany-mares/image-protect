package com.inkshield.auth.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;

@Component
public class SesEmailSender implements EmailSender {
    private final SesV2Client ses = SesV2Client.builder().region(Region.US_EAST_1).build();
    private final String from;

    public SesEmailSender(@Value("${app.ses-from}") String from) {
        this.from = from;
    }

    @Override
    public void sendPasswordReset(String toEmail, String link) {
        ses.sendEmail(SendEmailRequest.builder()
                .fromEmailAddress(from)
                .destination(Destination.builder().toAddresses(toEmail).build())
                .content(EmailContent.builder().simple(Message.builder()
                        .subject(Content.builder().data("Reset your InkShield password").build())
                        .body(Body.builder().text(Content.builder()
                                .data("We received a request to reset your InkShield password.\n\n"
                                        + "Set a new password here (link expires in 1 hour):\n" + link
                                        + "\n\nIf you didn't request this, you can ignore this email.").build())
                                .build())
                        .build()).build())
                .build());
    }
}
