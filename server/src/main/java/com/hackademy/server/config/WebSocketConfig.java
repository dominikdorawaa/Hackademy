package com.hackademy.server.config;

import com.hackademy.server.cors.CorsProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import com.hackademy.server.realtime.RealtimeSubscriptionInterceptor;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthInterceptor authInterceptor;
    private final RealtimeSubscriptionInterceptor subscriptionInterceptor;
    private final CorsProperties corsProperties;

    public WebSocketConfig(WebSocketAuthInterceptor authInterceptor, RealtimeSubscriptionInterceptor subscriptionInterceptor,
            CorsProperties corsProperties) {
        this.authInterceptor = authInterceptor;
        this.subscriptionInterceptor = subscriptionInterceptor;
        this.corsProperties = corsProperties;
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.taskExecutor().corePoolSize(4).maxPoolSize(16).queueCapacity(10000);
        registration.interceptors(authInterceptor, subscriptionInterceptor);
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.taskExecutor().corePoolSize(4).maxPoolSize(16).queueCapacity(10000);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[] {10000, 10000})
                .setTaskScheduler(webSocketHeartbeatScheduler());
        config.setApplicationDestinationPrefixes("/app");
        config.setPreservePublishOrder(true);
    }

    @Bean
    public ThreadPoolTaskScheduler webSocketHeartbeatScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("websocket-heartbeat-");
        return scheduler;
    }

    @Bean(name = "taskScheduler")
    public ThreadPoolTaskScheduler taskScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("application-schedule-");
        return scheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(corsProperties.allowedOrigins().toArray(String[]::new))
                .withSockJS();
    }
}
