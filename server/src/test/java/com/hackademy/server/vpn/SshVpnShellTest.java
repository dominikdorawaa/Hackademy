package com.hackademy.server.vpn;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SshVpnShellTest {

    private final Logger logger = (Logger) LoggerFactory.getLogger(SshVpnShell.class);
    private final ListAppender<ILoggingEvent> events = new ListAppender<>();
    private final ByteArrayOutputStream stdout = new ByteArrayOutputStream();
    private final ByteArrayOutputStream stderr = new ByteArrayOutputStream();
    private Level previousLevel;
    private PrintStream previousOut;
    private PrintStream previousErr;

    @BeforeEach
    void captureOutput() {
        previousLevel = logger.getLevel();
        logger.setLevel(Level.DEBUG);
        // Keep the root console appender out, so anything on stdout/stderr comes from println.
        logger.setAdditive(false);
        events.start();
        logger.addAppender(events);
        previousOut = System.out;
        previousErr = System.err;
        System.setOut(new PrintStream(stdout));
        System.setErr(new PrintStream(stderr));
    }

    @AfterEach
    void restoreOutput() {
        System.setOut(previousOut);
        System.setErr(previousErr);
        logger.detachAppender(events);
        logger.setLevel(previousLevel);
        logger.setAdditive(true);
    }

    @Test
    void scriptOutputGoesThroughLoggerNotConsole() {
        SshVpnShell.logScriptOutput("client created", "warning: reused key");

        assertEquals(List.of(
                        Level.DEBUG + " VPN script output: client created",
                        Level.WARN + " VPN script error output: warning: reused key"),
                events.list.stream().map(e -> e.getLevel() + " " + e.getFormattedMessage()).toList());
        assertEquals(0, stdout.size());
        assertEquals(0, stderr.size());
    }

    @Test
    void emptyErrorOutputIsNotLoggedAsWarning() {
        SshVpnShell.logScriptOutput("client created", "  ");

        assertEquals(List.of(Level.DEBUG), events.list.stream().map(ILoggingEvent::getLevel).toList());
    }
}
