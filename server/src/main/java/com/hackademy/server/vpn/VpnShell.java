package com.hackademy.server.vpn;

public interface VpnShell {

    byte[] run(String generateCommand, String readCommand) throws Exception;
}
