package com.hackademy.server.vpn;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Service
public class VpnService {

    private final VpnShell shell;
    private final String vpnUser;

    public VpnService(VpnShell shell, @Value("${vpn.server.user}") String vpnUser) {
        this.shell = shell;
        this.vpnUser = vpnUser;
    }

    public Resource generateVpnConfig(String username) throws Exception {
        String safeUsername = username.replaceAll("[^a-zA-Z0-9_-]", "");

        // 1. Run our wrapper script (generate-client.sh)
        // Assuming script is in the user's home directory
        String command = "sudo ./generate-client.sh " + safeUsername;

        // 2. Read file
        // The script generates it at /home/user/username.ovpn
        String remoteFilePath = "/home/" + vpnUser + "/" + safeUsername + ".ovpn";
        String catCommand = "sudo cat " + remoteFilePath;

        byte[] fileContent = shell.run(command, catCommand);

        if (fileContent.length == 0) {
            throw new IOException("Failed to read VPN config file. File is empty. Check server logs.");
        }

        return new ByteArrayResource(fileContent);
    }
}
