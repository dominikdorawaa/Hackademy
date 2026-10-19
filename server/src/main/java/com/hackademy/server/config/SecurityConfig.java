package com.hackademy.server.config;

import com.hackademy.server.clerk.ClerkAuthenticationFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;


@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final ClerkAuthenticationFilter clerkAuthenticationFilter;

    public SecurityConfig(ClerkAuthenticationFilter clerkAuthenticationFilter) {
        this.clerkAuthenticationFilter = clerkAuthenticationFilter;
    }

    @Bean
    public FilterRegistrationBean<ClerkAuthenticationFilter> clerkAuthenticationFilterRegistration() {
        FilterRegistrationBean<ClerkAuthenticationFilter> registration = new FilterRegistrationBean<>(clerkAuthenticationFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/").permitAll()
                .requestMatchers("/health").permitAll()
                .requestMatchers("/ws", "/ws/**").permitAll()
                .requestMatchers("/api/user/ranking").permitAll()
                .requestMatchers("/api/ranking/**").permitAll()
                .requestMatchers("/api/rooms/top3").permitAll()
                .requestMatchers(RegexRequestMatcher.regexMatcher("^/api/paths/.*/banner$")).permitAll()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .addFilterBefore(clerkAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
