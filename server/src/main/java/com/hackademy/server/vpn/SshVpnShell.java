package com.hackademy.server.vpn;

import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ClientChannel;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.common.config.keys.FilePasswordProvider;
import org.apache.sshd.common.util.security.SecurityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.KeyPair;
import java.util.EnumSet;
import java.util.concurrent.TimeUnit;

@Component
public class SshVpnShell implements VpnShell {

    private final ResourceLoader resourceLoader;

    public SshVpnShell(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    @Value("${vpn.server.host}")
    private String vpnHost;

    @Value("${vpn.server.user}")
    private String vpnUser;

    @Value("${vpn.server.private-key-path}")
    private String privateKeyPath;

    @Override
    public byte[] run(String generateCommand, String readCommand) throws Exception {
        try (SshClient client = SshClient.setUpDefaultClient()) {
            client.start();

            if (privateKeyPath == null || privateKeyPath.isBlank()) {
                throw new IOException("VPN private key is not configured");
            }

            byte[] keyBytes;
            try (InputStream keyStream = resourceLoader.getResource(privateKeyPath).getInputStream()) {
                keyBytes = StreamUtils.copyToByteArray(keyStream);
            }

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

                ByteArrayOutputStream errorStream = new ByteArrayOutputStream();
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

                try (ClientChannel channel = session.createExecChannel(generateCommand)) {
                    channel.setErr(errorStream);
                    channel.setOut(outputStream);
                    channel.open().verify(10000);
                    channel.waitFor(EnumSet.of(ClientChannelEvent.CLOSED), TimeUnit.SECONDS.toMillis(30));
                }

                // Log output for debugging
                System.out.println("VPN Script Output: " + outputStream.toString());
                System.err.println("VPN Script Error: " + errorStream.toString());

                ByteArrayOutputStream responseStream = new ByteArrayOutputStream();
                try (ClientChannel channel = session.createExecChannel(readCommand)) {
                    channel.setOut(responseStream);
                    channel.open().verify(10000);
                    channel.waitFor(EnumSet.of(ClientChannelEvent.CLOSED), TimeUnit.SECONDS.toMillis(10));
                }

                return responseStream.toByteArray();
            }
        }
    }
}
