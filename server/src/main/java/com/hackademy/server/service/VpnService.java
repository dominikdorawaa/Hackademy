package com.hackademy.server.service;

import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ClientChannel;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.common.config.keys.FilePasswordProvider;
import org.apache.sshd.common.util.security.SecurityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.KeyPair;
import java.util.Collection;
import java.util.EnumSet;
import java.util.concurrent.TimeUnit;

@Service
public class VpnService {

    @Value("${vpn.server.host}")
    private String vpnHost;

    @Value("${vpn.server.user}")
    private String vpnUser;

    @Value("${vpn.server.private-key-path}")
    private String privateKeyPath;

    public Resource generateVpnConfig(String username) throws Exception {
        try (SshClient client = SshClient.setUpDefaultClient()) {
            client.start();
            
            InputStream keyStream = getClass().getClassLoader().getResourceAsStream("gcp_key.pem");
            if (keyStream == null) {
                throw new IOException("Private key not found in classpath");
            }
            
            byte[] keyBytes = StreamUtils.copyToByteArray(keyStream);
            
            Iterable<KeyPair> keys = SecurityUtils.loadKeyPairIdentities(
                    null,
                    null,
                    new java.io.ByteArrayInputStream(keyBytes),
                    FilePasswordProvider.EMPTY
            );
            
            if (!keys.iterator().hasNext()) {
                 throw new IOException("Failed to parse private key.");
            }
            
            try (ClientSession session = client.connect(vpnUser, vpnHost, 22).verify(10000).getSession()) {
                for (KeyPair key : keys) {
                    session.addPublicKeyIdentity(key);
                }
                session.auth().verify(10000);

                String safeUsername = username.replaceAll("[^a-zA-Z0-9_-]", "");
                
                // 1. Run our wrapper script (generate-client.sh)
                // Assuming script is in the user's home directory
                String command = "sudo ./generate-client.sh " + safeUsername;
                
                ByteArrayOutputStream errorStream = new ByteArrayOutputStream();
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                
                try (ClientChannel channel = session.createExecChannel(command)) {
                    channel.setErr(errorStream);
                    channel.setOut(outputStream);
                    channel.open().verify(10000);
                    channel.waitFor(EnumSet.of(ClientChannelEvent.CLOSED), TimeUnit.SECONDS.toMillis(30));
                }
                
                // Log output for debugging
                System.out.println("VPN Script Output: " + outputStream.toString());
                System.err.println("VPN Script Error: " + errorStream.toString());

                // 2. Read file
                // The script generates it at /home/user/username.ovpn
                String remoteFilePath = "/home/" + vpnUser + "/" + safeUsername + ".ovpn";
                String catCommand = "sudo cat " + remoteFilePath;
                
                ByteArrayOutputStream responseStream = new ByteArrayOutputStream();
                try (ClientChannel channel = session.createExecChannel(catCommand)) {
                    channel.setOut(responseStream);
                    channel.open().verify(10000);
                    channel.waitFor(EnumSet.of(ClientChannelEvent.CLOSED), TimeUnit.SECONDS.toMillis(10));
                }
                
                byte[] fileContent = responseStream.toByteArray();
                
                if (fileContent.length == 0) {
                    throw new IOException("Failed to read VPN config file. File is empty. Check server logs.");
                }

                return new ByteArrayResource(fileContent);
            }
        }
    }
}
