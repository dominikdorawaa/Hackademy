package com.hackademy.server.user;

public class ReverificationRequiredException extends RuntimeException {

    public static final int AFTER_MINUTES = 10;

    public ReverificationRequiredException() {
        super("Potwierdź tożsamość kodem wysłanym na Twój adres e-mail.");
    }
}
