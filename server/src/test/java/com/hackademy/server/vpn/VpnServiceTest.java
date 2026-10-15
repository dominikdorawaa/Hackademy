package com.hackademy.server.vpn;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VpnServiceTest {

    @Mock VpnShell shell;

    @Test
    void generatesAndReadsConfigForSanitizedUsername() throws Exception {
        when(shell.run("sudo ./generate-client.sh alicerm-rf", "sudo cat /home/vpn/alicerm-rf.ovpn"))
                .thenReturn("client".getBytes());

        var config = new VpnService(shell, "vpn").generateVpnConfig("alice; rm -rf /");

        assertArrayEquals("client".getBytes(), config.getContentAsByteArray());
    }

    @Test
    void keepsLettersDigitsDashesAndUnderscores() throws Exception {
        when(shell.run(any(), any())).thenReturn(new byte[] {1});

        new VpnService(shell, "vpn").generateVpnConfig("Ala_1-x$(id)`../`");

        verify(shell).run("sudo ./generate-client.sh Ala_1-xid", "sudo cat /home/vpn/Ala_1-xid.ovpn");
    }

    @Test
    void emptyConfigIsAnError() throws Exception {
        when(shell.run(any(), any())).thenReturn(new byte[0]);

        assertThrows(IOException.class, () -> new VpnService(shell, "vpn").generateVpnConfig("alice"));
    }

    @Test
    void shellFailuresPropagate() throws Exception {
        when(shell.run(any(), any())).thenThrow(new IOException("VPN private key is not configured"));

        var error = assertThrows(IOException.class, () -> new VpnService(shell, "vpn").generateVpnConfig("alice"));
        assertEquals("VPN private key is not configured", error.getMessage());
    }
}
