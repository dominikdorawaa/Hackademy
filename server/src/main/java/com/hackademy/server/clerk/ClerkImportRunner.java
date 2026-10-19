package com.hackademy.server.clerk;

import com.hackademy.server.user.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@ConditionalOnProperty(name = "application.clerk.import-users", havingValue = "true")
public class ClerkImportRunner implements ApplicationRunner {

    private final ClerkUserImporter importer;
    private final ConfigurableApplicationContext context;

    public ClerkImportRunner(UserRepository userRepository, ClerkProperties properties, RestClient.Builder builder,
                             ConfigurableApplicationContext context) {
        this.importer = new ClerkUserImporter(userRepository, new ClerkBackendClient(builder, properties));
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) {
        ClerkUserImporter.ImportResult result = importer.importAll();
        if (result.failed() != 0) throw new IllegalStateException("Clerk import failed for " + result.failed() + " accounts");
        context.close();
    }
}
