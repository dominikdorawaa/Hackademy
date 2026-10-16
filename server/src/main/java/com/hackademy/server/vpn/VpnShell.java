package com.hackademy.server.vpn;

/** Runs commands on the VPN server so {@link VpnService} can be tested without SSH. */
public interface VpnShell {

    /** Runs {@code generateCommand}, then {@code readCommand}, and returns the output of the read command. */
    byte[] run(String generateCommand, String readCommand) throws Exception;
}
